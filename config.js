require('dotenv').config();

var AUTH_ISSUER = process.env.AUTH_ISSUER || 'https://{yourOktaDomain}.com/oauth2/default';
var SPA_CLIENT_ID = process.env.SPA_CLIENT_ID || '{spaClientId}';

module.exports = {
  resourceServer: {
    oidc: {
      clientId: SPA_CLIENT_ID,
      issuer: AUTH_ISSUER,
      testing: {
        disableHttpsCheck: false
      }
    },
    assertClaims: {
      aud: 'api://default',
      cid: SPA_CLIENT_ID
    }
  }
};
