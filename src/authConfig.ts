export const config = {
    clientId : process.env.CIVIC_AUTH_CLIENT_ID!,
    redirectUrl: 'http://localhost:5000/auth/callback', // change to your domain when deploying,
    postLogoutRedirectUrl: 'http://localhost:5000/' // The postLogoutRedirectUrl is the URL where the user will be redirected after successfully logging out from Civic's auth server.
};