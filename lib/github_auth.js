'use strict'

const config = require('config')
const express = require('express')
const fs = require('fs')
const querystring = require('querystring')
const opn = require('opn')
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
  constructor(client_id, redirect_uri) {
    this._client_id = client_id
    this._redirect_uri = redirect_uri
    this._app = express()
    this._server = null
    this._states = {}

    this._express_setup()
  }

  authorize(scope, allow_signup) {
    scope = scope || ''
    allow_signup = allow_signup === undefined || !!allow_signup

    const state = uuid.v4()

    let params = {
      allow_signup: allow_signup,
      client_id: this._client_id,
      redirect_uri: this._redirect_uri,
      scope: scope,
      state: state
    }

    opn(`${GITHUB_OAUTH_ENDPOINT}?${querystring.stringify(params)}`)

    return new Promise((resolve, reject) => {
      this._states[state] = { resolve, reject }
    })
  }

  close() {
    return new Promise((resolve, reject) => {
      if (this._server) {
        this._server.close(() => {
          this._server = null
          winston.verbose('Auth server stopped listening.')
          resolve()
        })
      } else {
        reject('Server was not listening.')
      }
    })
  }

  _express_setup() {
    if (!this._server) {
      const {pathname, port} = url.parse(this._redirect_uri)
      this._app.set('views')
      this._app.get(pathname, this._callback.bind(this))
      this._app.use('*', (req, res) => renderHTML(res, HTML_404, 404))
      this._server = this._app.listen(port, () => {
        winston.verbose(`Auth server listening at ${this._redirect_uri}`)
      })
    }
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
