export const environment = {
  production: false,
  // Use relative paths; dev proxy will forward to the target
  apiBasePath: '/api',
  oauthTokenEndpoint: '/api/oauth2/v1/token',
  // Dev credentials to speed up testing (do NOT use in prod builds)
  devUsername: 'admin',
  devPassword: 'Ade*ade*453030',
};
