import { createApp } from "./app";
import type { Env } from "./env";
import { SessionRepository } from "./repository";

const app = createApp();

export default {
  fetch: app.fetch,

  /** JST 03:00（UTC 18:00 = wrangler.jsonc の crons）に全データを削除する日次リセット。 */
  async scheduled(_controller: ScheduledController, env: Env): Promise<void> {
    await new SessionRepository(env.DB).purgeAll();
    console.info("日次リセット（JST 03:00）を実行しました");
  }
} satisfies ExportedHandler<Env>;
