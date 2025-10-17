export const environment = {
  production: false,
  // Use relative paths; dev proxy will forward to the target
  apiBasePath: 'http://10.0.132.4:8097/app-root/api',
  oauthTokenEndpoint: 'http://10.0.132.4:8097/app-root/api/oauth2/v1/token',
  // Dev credentials to speed up testing (do NOT use in prod builds)
  devUsername: 'admin',
  devPassword: 'Ade*ade*453030',
};
