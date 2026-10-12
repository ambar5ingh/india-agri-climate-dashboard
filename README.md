# India Agri-Climate Results

A free, self-updating dashboard on India's food, land, water and climate indicators, modelled loosely on the [CGIAR Results Dashboard](https://www.cgiar.org/food-security-impact/results-dashboard). It runs entirely on GitHub: a scheduled GitHub Action pulls the data every Monday, commits it, and publishes the site on GitHub Pages. No server, no paid tools.

## What's on it

| Section | Source | Key needed? |
|---|---|---|
| At a glance tiles | Latest values from the sources below | – |
| Emissions (total GHG, methane, N₂O since 1990) | [Our World in Data CO₂/GHG dataset](https://github.com/owid/co2-data) | No |
| Water, land & livelihoods (irrigation, agri water use, cereal yield, agri land, agri GDP share, agri jobs, renewable energy share) | [World Bank Open Data API](https://data.worldbank.org) | No |
| States (PM-KUSUM pumps, groundwater extraction, irrigated area, agri electricity) | [data.gov.in OGD API](https://data.gov.in) | Yes, free |
| Results register (policies, partnerships, capacity-sharing, progress) | `data/results_register.csv`, curated by you | – |

Each chart has a **Table** button and a link to its source.

## Set it up (about 15 minutes)

1. Create a new GitHub repository and upload everything in this folder (keep the `.github` folder; it's hidden on some systems).
2. In the repo go to **Settings → Pages → Build and deployment → Source** and choose **GitHub Actions**.
3. Go to **Actions → Refresh data and publish dashboard → Run workflow**. The first run takes about a minute; the site URL appears on the run's *deploy* step (`https://<username>.github.io/<repo>/`).

At this point emissions, national trends and the register are live.

## Add state-level data

1. Sign up at [data.gov.in](https://data.gov.in) and copy your API key from your account page.
2. In the repo: **Settings → Secrets and variables → Actions → New repository secret**, name it `DATA_GOV_IN_API_KEY`.
3. On data.gov.in, find a state-wise dataset (the comments in `pipeline/sources.yml` suggest search terms), open its **API** tab and copy the resource ID. The preview there shows the column names.
4. Fill `resource_id`, `state_field` and `value_field` for that entry in `pipeline/sources.yml`, commit, and the workflow reruns on its own.

You can add more datasets the same way; each becomes a ranked bar chart of states.

## Add to the results register

Add a row to `data/results_register.csv` with `date, type, state, title, detail, organisation, source_url` and commit. Suggested types: Policy change, Progress, Partnership, Capacity sharing, Innovation/pilot. Use `National` for country-wide entries.

## Run locally

```bash
pip install -r requirements.txt
python pipeline/fetch.py            # add DATA_GOV_IN_API_KEY=... for state data
cd site && python -m http.server    # open http://localhost:8000
```

If one source fails, the pipeline keeps the last good copy of it and still updates the rest. `site/data/meta.json` records what succeeded on each run.

## Ideas for next steps

- A choropleth map of states (add an India states GeoJSON to `site/` and draw with Leaflet or D3).
- More sources: MNRE physical progress reports, CGWB groundwater, ICRISAT district-level agriculture data, IMD rainfall.
- A state filter that carries across every section.
