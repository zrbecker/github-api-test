const config = require('config')
const githubAuth = require('./lib/githubAuth')
const winston = require('winston')

const GithubAuthHandler = githubAuth.GithubAuthHandler

;(async () => {
  try {
    const {clientId, redirectUri} = config.get('githubApi')
    const authHandler = new GithubAuthHandler(clientId, redirectUri)
    await authHandler.listen()
    const authorizationCode = await authHandler.authorize()
    winston.debug(`Access token "${authorizationCode}"`)
    await authHandler.close()
  } catch (e) {
    winston.error(e)
  }
})()
