# MetaScraper

To get all Meta/Oculus applications from the Oculus Store for the MetaCode application, I wrote this little scraper that get all the applications and their information and then store them into a Supabase database.

## ENV Variables

- `SUPABASE_URL`: The URL of the Supabase database
- `SUPABASE_KEY`: The key of the Supabase database
- `OCULUS_ACCESS_TOKEN`: The access token of the Oculus API

## Install the scraper

```bash
npm install -g
metascraper <command> [options]
```

## Usage

```bash
Usage: ./bin/index.js || metascraper [options] [command]

Options:
  -h, --help       display help for command

Commands:
  get <option>     Retrieve store applications
  update <option>  Update applications and headsets infos
  help [command]   display help for command
```

