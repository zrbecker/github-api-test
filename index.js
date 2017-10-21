const config = require('config')
const github_auth = require('./lib/github_auth')
const winston = require('winston')

const GithubAuthHandler = github_auth.GithubAuthHandler

;(async () => {
  try {
    const {client_id, redirect_uri} = config.get('github_api')
    const authHandler = new GithubAuthHandler(client_id, redirect_uri)
    const autherizationCode = await authHandler.authorize()
    winston.debug(`Access token "${autherizationCode}"`)
    await authHandler.close()
  } catch (e) {
    winston.error(e)
  }
})()
