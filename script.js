require('dotenv').config();
const axios = require('axios');
const { RateLimiter } = require('limiter');
const readline = require('readline/promises');

class GitHubFollower {
  constructor() {
    this.configureHttpClient();
    this.rateLimiter = new RateLimiter({
      tokensPerInterval: 5000,
      interval: 'hour'
    });
    this.debugMode = process.env.DEBUG === 'true';
  }

  configureHttpClient() {
    this.client = axios.create({
      baseURL: 'https://api.github.com',
      headers: {
        'Authorization': `token ${process.env.GH_TOKEN}`,
        'User-Agent': 'GitHub-Follower/1.0',
        'Accept': 'application/vnd.github.v3+json',
        'X-GitHub-Api-Version': '2022-11-28'
      }
    });
  }

  async validateToken() {
    try {
      const response = await this.client.get('/user', {
        validateStatus: () => true
      });

      this.logDebug('Token validation response', {
        status: response.status,
        headers: this.sanitizeHeaders(response.headers),
        data: response.data
      });

      if (response.status !== 200) {
        throw new Error(`Token validation failed (${response.status}): ${response.data.message}`);
      }

      const scopes = response.headers['x-oauth-scopes']?.split(', ') || [];
      console.log(scopes);
      if (!scopes.includes('user')) {
        throw new Error(`Missing required scope 'user:follow'. Current scopes: ${scopes.join(', ')}`);
      }

      return {
        username: response.data.login,
        scopes,
        rateLimit: {
          limit: response.headers['x-ratelimit-limit'],
          remaining: response.headers['x-ratelimit-remaining'],
          reset: new Date(response.headers['x-ratelimit-reset'] * 1000)
        }
      };
    } catch (error) {
      this.logError('Token validation failed', {
        message: error.message,
        response: error.response?.data,
        stack: this.debugMode ? error.stack : undefined
      });
      process.exit(1);
    }
  }

  async followUser(username) {
    const logData = {
      timestamp: new Date().toISOString(),
      username,
      attempt: 1,
      status: 'pending',
      headers: null,
      error: null
    };

    try {
      await this.rateLimiter.removeTokens(1);
      const response = await this.client.put(`/user/following/${username}`, {}, {
        validateStatus: () => true
      });

      logData.status = response.status;
      logData.headers = this.sanitizeHeaders(response.headers);

      if (response.status === 204) {
        this.logSuccess(`Followed ${username}`);
        return true;
      }

      if (response.status === 403) {
        logData.error = this.parse403Error(response);
        this.handle403Error(logData.error);
      }

      this.logAttempt(logData);
      return false;

    } catch (error) {
      logData.error = {
        message: error.message,
        stack: this.debugMode ? error.stack : undefined,
        response: error.response?.data
      };
      this.logError('Follow operation failed', logData);
      return false;
    }
  }

  parse403Error(response) {
    return {
      type: 'PERMISSION_DENIED',
      message: response.data.message,
      documentation: response.data.documentation_url,
      requiredPermissions: response.headers['x-accepted-github-permissions'],
      rateLimit: {
        remaining: response.headers['x-ratelimit-remaining'],
        reset: new Date(response.headers['x-ratelimit-reset'] * 1000)
      }
    };
  }

  handle403Error(error) {
    if (error.rateLimit.remaining === '0') {
      const waitTime = error.rateLimit.reset - Date.now() + 1000;
      console.warn(`⚠️ Rate limit exceeded. Waiting ${Math.round(waitTime/1000)}s...`);
      return new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    if (error.message.includes('integration')) {
      console.error('🚫 Token permissions issue:');
      console.error(`- Required: ${error.requiredPermissions}`);
      console.error(`- Docs: ${error.documentation}`);
      process.exit(1);
    }
  }

  sanitizeHeaders(headers) {
    return {
      'x-ratelimit-limit': headers['x-ratelimit-limit'],
      'x-ratelimit-remaining': headers['x-ratelimit-remaining'],
      'x-ratelimit-reset': headers['x-ratelimit-reset'],
      'x-accepted-github-permissions': headers['x-accepted-github-permissions']
    };
  }

  logDebug(message, data) {
    if (this.debugMode) {
      console.debug(JSON.stringify({
        type: 'DEBUG',
        timestamp: new Date().toISOString(),
        message,
        ...data
      }, null, 2));
    }
  }

  logSuccess(message) {
    console.log(`✅ ${new Date().toISOString()} | ${message}`);
  }

  logAttempt(data) {
    console.log(JSON.stringify({
      type: 'ATTEMPT',
      ...data
    }, null, 2));
  }

  logError(context, error) {
    console.error(JSON.stringify({
      type: 'ERROR',
      timestamp: new Date().toISOString(),
      context,
      ...error
    }, null, 2));
  }

  async run() {
    try {
      const userInfo = await this.validateToken();
      console.log(`🔑 Authenticated as: ${userInfo.username}`);
      console.log(`🔐 Scopes: ${userInfo.scopes.join(', ')}`);
      console.log(`⏱️  Rate limit: ${userInfo.rateLimit.remaining}/${userInfo.rateLimit.limit}`);

      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

      const repoUrl = await rl.question('Enter repository (owner/repo): ');
      const [owner, repo] = repoUrl.split('/').filter(Boolean);
      const startPage = parseInt(await rl.question('Start page: ') || 1);
      rl.close();

      let page = startPage;
      while (true) {
        const users = await this.getStargazers(owner, repo, page);
        if (users.length === 0) break;

        for (const username of users) {
          const success = await this.followUser(username);
          await new Promise(resolve => setTimeout(resolve, success ? 1500 : 5000));
        }
        page++;
      }
    } catch (error) {
      this.logError('Runtime error', {
        message: error.message,
        stack: this.debugMode ? error.stack : undefined
      });
    }
  }

  async getStargazers(owner, repo, page) {
    try {
      const response = await this.client.get(`/repos/${owner}/${repo}/stargazers`, {
        params: {
          page,
          per_page: 100
        }
      });
      return response.data.map(user => user.login);
    } catch (error) {
      this.logError('Failed to fetch stargazers', {
        owner,
        repo,
        page,
        error: error.response?.data || error.message
      });
      return [];
    }
  }
}

// Run the application
new GitHubFollower().run();
