import request from "supertest";
import User from "../../auth/User.js";
import UserManager from "../../auth/UserManager.js";
import { TaskScheduler } from "../../tasks/scheduler.js";

/**
 * Huaka (patches/ecorpus/0004): the login-link email follows the requester's
 * language instead of always using connection_fr.
 */
describe("POST /auth/login/:username/link language", function(){
  let userManager :UserManager, scheduler :TaskScheduler<any>, user :User, admin :User;

  this.beforeAll(async function(){
    const locals = await createIntegrationContext(this);
    userManager = locals.userManager;
    scheduler = locals.taskScheduler;
  });

  this.beforeEach(async function(){
    await resetIntegrationContext(this);
    user = await userManager.addUser("bob", "12345678", "create", "bob@example.com");
    admin = await userManager.addUser("alice", "12345678", "admin");
  });

  async function adminAgent(server: any){
    const agent = request.agent(server);
    await agent.post("/auth/login")
      .send({username: admin.username, password: "12345678"})
      .set("Content-Type", "application/json")
      .set("Accept", "")
      .expect(200);
    return agent;
  }

  async function lastEmail(){
    //sendLoginLink does not await the task: wait for it to finish, so that it
    //doesn't write its logs after the next test resets the database
    for(let i = 0; i < 100; i++){
      const tasks = await scheduler.getTasks({ type: "sendEmail", status: "all" });
      if(tasks.length && (tasks[0].status === "success" || tasks[0].status === "error")){
        return tasks[0].data as {subject: string, html: string};
      }
      await new Promise(r => setTimeout(r, 20));
    }
    throw new Error("No sendEmail task was created");
  }

  for(const [lang, subject, html] of [
    ["es", /^Su enlace de acceso a /, /enlace de acceso/],
    ["fr", /^Votre lien de connexion/, /lien de connexion/],
    ["en", /^Your login link to /, /connection link/],
  ] as const){
    it(`uses the ${lang} template and subject from Accept-Language`, async function(){
      await (await adminAgent(this.server)).post(`/auth/login/${user.username}/link`)
        .set("Accept-Language", lang)
        .expect(204);
      const email = await lastEmail();
      expect(email.subject).to.match(subject);
      expect(email.html).to.match(html);
    });
  }

  it("defaults to english", async function(){
    await (await adminAgent(this.server)).post(`/auth/login/${user.username}/link`)
      .set("Accept-Language", "de")
      .expect(204);
    expect((await lastEmail()).subject).to.match(/^Your login link to /);
  });
});
