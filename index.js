const config = require('config')
const github_auth = require('./lib/github_auth')
const winston = require('winston')

const GithubAuthHandler = github_auth.GithubAuthHandler

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
