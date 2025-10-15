export const environment = {
  production: true,
  // Use only the API path; auth interceptor will prefix with /app-root
  apiBasePath: '/api',
  oauthTokenEndpoint: '/api/oauth2/v1/token',
};
