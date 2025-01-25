
# GitHub Auto-Follow ⚡

[![Version](https://img.shields.io/badge/version-1.0.0-blue)](https://github.com/devansh-m12/github-follow) 
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![CI](https://img.shields.io/github/actions/workflow/status/devansh-m12/github-follow/main.yml)](https://github.com/devansh-m12/github-follow/actions)
[![Dependencies](https://img.shields.io/librariesio/github/devansh-m12/github-follow)](https://libraries.io/github/devansh-m12/github-follow)

📌 _Automate GitHub follows while respecting rate limits_

## Star Map 🌟
```
devansh-m12/github-follow
├── 📁 src/            # Source code
├── 📄 script.js       # Main executable
├── 📄 .env.example    # Configuration template
└── 📄 LICENSE         # MIT License
```

## 30-Second Setup 🚦

1. **Get Token**  
   [Create PAT](https://github.com/settings/tokens) with `user:follow` scope

2. **Configure**
   ```bash
   git clone https://github.com/devansh-m12/github-follow.git
   cd github-follow
   echo "GH_TOKEN=your_token" > .env
   npm install
   ```

3. **Run**
   ```bash
   node script.js
   # Follow prompts for repo/page
   ```

## Key Configs ⚙️

| Variable   | Default | Purpose                |
|------------|---------|------------------------|
| `GH_TOKEN` | -       | GitHub PAT (Required)  |
| `DEBUG`    | `false` | Verbose logging        |

## Automation Schedule ⏰

```yaml
# .github/workflows/auto-follow.yml
name: Auto-Follow
on:
  schedule:
    - cron: '0 12 * * 1' # Mondays 12PM UTC
```

⚠️ **Ethical Use**  
This tool may violate GitHub's ToS if misused. Monitor your follow limits.

---

[![Star History](https://api.star-history.com/svg?repos=devansh-m12/github-follow&type=Date)](https://star-history.com/#devansh-m12/github-follow&Date)
