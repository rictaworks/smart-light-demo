/** Worker の束縛と変数（wrangler.jsonc の d1_databases / vars と対応）。 */
export interface Env {
  DB: D1Database;
  /** "production" など。ログの識別にだけ使う。 */
  ENV: string;
  /** CORS で許可する本番フロントの origin。 */
  FRONTEND_URL: string;
  /**
   * 運用者による全体リセット（POST /api/admin/reset）用の管理トークン。
   * wrangler secret put ADMIN_RESET_TOKEN で設定する（値は wrangler.jsonc に書かない）。
   * 未設定または空の場合は、そのエンドポイントを無効化する（404）。
   */
  ADMIN_RESET_TOKEN?: string;
}
