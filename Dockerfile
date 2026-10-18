FROM node:22-slim AS build
# Build artifacts from sources
# Huaka: `patch` applies patches/{ecorpus,voyager}/*.patch (see scripts/apply-patches.sh)
RUN apt-get -qqy update && apt-get -qqy install --no-install-recommends patch \
  && rm -rf /var/lib/apt/lists/* /var/tmp/*
RUN mkdir -p /app/dist /app/source
WORKDIR /app

COPY source/server/package*.json /app/source/server/
RUN (cd /app/source/server && npm ci  --no-fund --no-audit )

COPY source/voyager/package*.json /app/source/voyager/
RUN (cd /app/source/voyager && npm ci --legacy-peer-deps  --no-fund --no-audit )

COPY source/ui/package*.json /app/source/ui/
RUN (cd /app/source/ui && npm ci  --no-fund --no-audit )

COPY ./package*.json /app/
RUN npm ci --no-fund --no-audit 


COPY source/server /app/source/server
# Huaka: fails the build if an eCorpus update no longer accepts a patch
COPY patches /app/patches
COPY scripts/apply-patches.sh /app/scripts/
RUN sh scripts/apply-patches.sh ecorpus
RUN npm run build-server
RUN grep -qF '"ES"' /app/source/server/dist/utils/languages.js \
  || { echo "ERROR: Huaka Spanish UI language missing from server build" >&2; exit 1; }
RUN grep -qF "Huaka Digital, todos los derechos" /app/source/server/dist/utils/schema/default.js \
  || { echo "ERROR: Huaka default copyright missing from server build" >&2; exit 1; }
RUN grep -qF "pageTitle" /app/source/server/dist/utils/templates/helpers/index.js \
  && grep -qF "{{pageTitle title}}" /app/source/server/templates/partials/head.hbs \
  || { echo "ERROR: Huaka page title translation missing from server build" >&2; exit 1; }
RUN grep -qF "acceptsLanguages(dicts" /app/source/server/dist/routes/auth/login.js \
  || { echo "ERROR: Huaka login link language missing from server build" >&2; exit 1; }
RUN grep -qF "renderShowcase" /app/source/server/dist/routes/views/index.js \
  && grep -qF "/ui/vitrina/" /app/source/server/templates/partials/navbar.hbs \
  || { echo "ERROR: Huaka public showcase missing from server build" >&2; exit 1; }
RUN grep -qF "shareFilesRouter" /app/source/server/dist/routes/index.js   && grep -qF "huakaShareLinks" /app/source/server/templates/scene/settings.hbs   || { echo "ERROR: Huaka share links missing from server build" >&2; exit 1; }
# outputs files in /app/source/server/dist

COPY source/voyager /app/source/voyager
# Huaka: fails the build if a Voyager update no longer accepts the patch
RUN sh scripts/apply-patches.sh voyager
COPY source/ui /app/source/ui
RUN npm run build-ui
# outputs files in /app/dist
# Huaka: guard against the patch applying but no longer reaching the bundle
RUN grep -qi "99193a" /app/dist/js/voyager-explorer.js \
  || { echo "ERROR: Huaka colors missing from voyager-explorer.js" >&2; exit 1; }
RUN grep -qF ".5922,.7412,.7765" /app/dist/js/voyager-story.js \
  || { echo "ERROR: Huaka default annotation color missing from voyager-story.js" >&2; exit 1; }
RUN grep -qF "logo-full-white.svg" /app/dist/js/voyager-explorer.js \
  || { echo "ERROR: Huaka white viewer logo missing from voyager-explorer.js" >&2; exit 1; }
RUN grep -qF "translatePanels" /app/dist/js/voyager-story.js \
  && grep -qF "noToursText" /app/dist/js/voyager-explorer.js \
  || { echo "ERROR: Huaka Story panel translation missing from the Voyager bundles" >&2; exit 1; }
RUN grep -qE "getUILocalizedString\([^()]*\.ins\.mode\.getOptionText\(\)\)" /app/dist/js/voyager-story.js \
  || { echo "ERROR: Huaka editor mode translation missing from voyager-story.js" >&2; exit 1; }
# Huaka: ship license texts and attribution with the redistributed image
# (Apache-2.0 §4; ff-* libs inside Voyager are MIT). Fails if one goes missing.
COPY NOTICE.md /app/licenses/
RUN mkdir -p /app/licenses/voyager/libs \
  && cp source/server/LICENSE.md /app/licenses/LICENSE.md \
  && cp source/voyager/LICENSE.md source/voyager/3RD_PARTY_LICENSES.txt source/voyager/ATTRIBUTIONS.md /app/licenses/voyager/ \
  && for d in source/voyager/libs/*/; do cp "$d/LICENSE.md" "/app/licenses/voyager/libs/$(basename "$d")-LICENSE.md" || exit 1; done

FROM node:22-slim AS utilities
# Fetch utilities that needs to be included

#Install dependencies
RUN apt-get -qqy update && apt-get -qqy install  --no-install-recommends \
  xz-utils lbzip2 \
  ca-certificates \
  curl \
  && rm -rf /var/lib/apt/lists/* /var/tmp/*

#Install ktx
RUN curl -fsSL -o "/tmp/KTX-Software-Linux-x86_64.tar.bz2" "https://github.com/KhronosGroup/KTX-Software/releases/download/v4.4.2/KTX-Software-4.4.2-Linux-x86_64.tar.bz2"\
  && tar -xf "/tmp/KTX-Software-Linux-x86_64.tar.bz2" -C /usr/local/ --strip-components=1 \
  && rm -rf /tmp/*

FROM node:22-slim
# Build the distributed container
LABEL org.opencontainers.image.source=https://github.com/Holusion/eCorpus
LABEL org.opencontainers.image.description="eCorpus base image"
LABEL org.opencontainers.image.documentation="https://ecorpus.eu"
LABEL org.opencontainers.image.vendor="Holusion SAS"
LABEL org.opencontainers.image.licenses="Apache-2.0"

ARG PORT
ARG PUBLIC
ARG BUILD_REF

ENV PUBLIC=${PUBLIC:-false}
ENV PORT=${PORT:-8000}
ENV BUILD_REF=${BUILD_REF}

ENV NODE_ENV=production

#Install additional runtime dependencies
RUN apt-get -qqy update && apt-get -qqy install  --no-install-recommends \
  ocl-icd-libopencl1 \
  && ln -s libOpenCL.so.1 /usr/lib/x86_64-linux-gnu/libOpenCL.so\
  && rm -rf /var/lib/apt/lists/* /var/tmp/*

COPY --from=utilities /usr/local/lib /usr/local/lib
COPY --from=utilities /usr/local/bin /usr/local/bin


WORKDIR /app
COPY source/server/package*.json /app/
#might occasionally fail if the prebuilt version can't be downloaded, 
# because it can't rebuild it locally
RUN npm ci --omit=dev --no-fund --no-audit 

COPY ./source/server/migrations /app/migrations
# Huaka: templates from the build stage, where patches/ecorpus was applied
COPY --from=build /app/source/server/templates /app/templates


COPY --from=build /app/dist /app/dist
COPY --from=build /app/source/server/dist /app/server
COPY --from=build /app/licenses /app/licenses

VOLUME [ "/app/files" ]
EXPOSE ${PORT}

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 CMD [ "node", "server/healthcheck.js" ]

CMD [ "node", "--disable-proto=delete", "server/index.js" ]
