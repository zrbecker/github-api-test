'use strict'

const config = require('config')
const express = require('express')
const fs = require('fs')
const http = require('http')
const opn = require('opn')
const querystring = require('querystring')
const uuid = require('uuid')
const url = require('url')
const winston = require('winston')

const GITHUB_OAUTH_ENDPOINT = 'https://github.com/login/oauth/authorize'
const HTML_SUCCESS = __dirname + '/../templates/oauth_success.html'
const HTML_404 = __dirname + '/../templates/oauth_404.html'
const HTML_500 = __dirname + '/../templates/oauth_500.html'

winston.level = config.has('winston.level')
  ? config.get('winston.level')
  : 'info'

function renderHTML(res, template, status) {
  status = status || 200
  fs.readFile(template, (err, data) => {
    res.setHeader('Content-Type', 'text/html')
    if (err) {
      winston.error(err)
      res.sendStatus(500)
    } else {
      res.status(status).send(data)
    }
  })
}

module.exports.GithubAuthHandler = class GithubAuthHandler {
  constructor(clientId, redirectUri) {
    this._clientId = clientId
    this._app = express()
    this._server = http.createServer(this._app)
    this._states = {}
    this._redirectUriParts = url.parse(redirectUri)

    this._expressSetup()
  }

  authorize(scope, allowSignup) {
    scope = scope || ''
    allowSignup = allowSignup === undefined || !!allowSignup

    const state = uuid.v4()

    let params = {
      'allow_signup': allowSignup,
      'client_id': this._clientId,
      'redirect_uri': this._redirectUriParts['href'],
      'scope': scope,
      'state': state
    }

    opn(`${GITHUB_OAUTH_ENDPOINT}?${querystring.stringify(params)}`)

    return new Promise((resolve, reject) => {
      this._states[state] = { resolve, reject }
    })
  }

  listen() {
    return new Promise((resolve, reject) => {
      const {port, hostname} = this._redirectUriParts
      this._server.listen(port, hostname, () => {
        winston.verbose(`Auth server listening at http://${hostname}:${port}`)
        resolve()
      })
      .on('error', err => reject(err))
    })
  }

  close() {
    return new Promise((resolve, reject) => {
      this._server.close(err => {
        if (err) {
          reject(err)
        } else {
          winston.verbose('Auth server stopped listening.')
          resolve()
        }
      })
    })
  }

  _expressSetup() {
    const {pathname} = this._redirectUriParts
    this._app.get(pathname, this._callback.bind(this))
    this._app.use('*', (req, res) => renderHTML(res, HTML_404, 404))
  }

  _callback(req, res) {
    winston.verbose(`Auth server callback with state ${req.query.state}.`)
    if (req.query.state) {
      this._states[req.query.state]['resolve'](req.query.code)
      delete this._states[req.query.state]
      renderHTML(res, HTML_SUCCESS)
    } else {
      renderHTML(res, HTML_404, 404)
    }
  }
}
