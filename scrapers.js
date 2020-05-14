const child_process = require("child_process");
const fs = require("fs").promises;
const fetch = require("node-fetch");
const semver = require("semver");

const { VERBOSE } = require('./utils');

const repoUri = 'https://registry.npmjs.org/';


function searchRepo(
  query,
  page = 0,
  pageination = 250
) {
  const uri = new URL('/-/v1/search', repoUri);
  uri.searchParams.append('text', query);
  uri.searchParams.append('size', pageination.toString());
  uri.searchParams.append('from', (pageination * page).toString());
  return fetch(uri.toString()).then((response) => {
    if (response.ok) {
      return response.json();
    }
    return [];
  });
}

function searchExtensions(
  query,
  page = 0,
  pageination = 250
) {
  // Note: Spaces are encoded to '+' signs!
  return searchRepo(`${query} keywords:"jupyterlab-extension"`, page, pageination);
}



/**
  * Fetch package.json of a package
  *
  * @param name The package name.
  * @param version The version of the package to fetch.
  */
async function fetchPackageMetadataForVersion(name, version) {
  const uri = new URL(`/${name}/${version || 'latest'}`, repoUri);
  const response = await fetch(uri.toString(), {headers: {Accept: 'application/vnd.npm.install-v1+json; q=1.0, application/json; q=0.8, */*'}});
  if (response.ok) {
    return response.json();
  }
  const text = await response.text();
  throw new Error(`${response.status} ${response.statusText}: ${text}`);
}



/**
  * Fetch package.json of a package
  *
  * @param name The package name.
  * @param version The version of the package to fetch.
  */
async function fetchPackageMetadata(name) {
  const uri = new URL(`/${name}`, repoUri);
  const response = await fetch(uri.toString(), {headers: {Accept: 'application/vnd.npm.install-v1+json; q=1.0, application/json; q=0.8, */*'}});
  if (response.ok) {
    return response.json();
  }
  const text = await response.text();
  throw new Error(`${response.status} ${response.statusText}: ${text}`);
}


async function getPackagePublishTimes(name) {
  let resolve, reject;
  const p = new Promise((_resolve, _reject) => {
    resolve = _resolve;
    reject = _reject;
  });
  child_process.exec(`npm view ${name} time --json`, (error, stdout, stderr) => {
    if (error) {
      console.log(stderr);
      reject(`Failed to call npm view: ${error}`)
    }
    resolve(JSON.parse(stdout));
  });
  return p;
}


async function getPackageVersions(name) {
  let resolve, reject;
  const p = new Promise((_resolve, _reject) => {
    resolve = _resolve;
    reject = _reject;
  });
  child_process.exec(`npm view ${name} versions --json`, (error, stdout, stderr) => {
    if (error) {
      console.log(stderr);
      reject(`Failed to call npm view: ${error}`)
    }
    resolve(JSON.parse(stdout));
  });
  return p;
}

class CachedBase {
  constructor(filename) {
    this._cache = {};
    this._filename = filename;
    this._ready = fs.readFile(filename)
      .then(value => {
        this._cache = JSON.parse(value);
      }).catch(reason => {
        // no-op
      })
  }

  async save() {
    await this._ready;
    await fs.writeFile(this._filename, JSON.stringify(this._cache));
  }

  async get(name, version) {
    throw new Error('Not implemented');
  }
}


class CachedPackageData extends CachedBase{
  async get(name, version) {
    await this._ready;
    if (version === 'latest' || this._cache[name] === undefined || this._cache[name].versions[version] === undefined) {
      if (VERBOSE) {
        console.log(`Requesting ${name} data`);
      }
      if (VERBOSE && version !== 'latest' && this._cache[name] !== undefined) {
        console.log(version);
      }
      this._cache[name] = await fetchPackageMetadata(name);
      this._cache[name].maxVersion = semver.maxSatisfying(
        Object.keys(this._cache[name].versions), '*'
      );
    }
    if (version === 'latest') {
      version = this._cache[name]['dist-tags'][version];
    }
    if (this._cache[name].versions[version] === undefined) {
      throw new Error(`Unable to fetch data for ${name}@${version}`);
    }
    return this._cache[name].versions[version];
  }
}

class CachedPublishTimes extends CachedBase {
  async get(name, version) {
    // The version acts as a cache-buster when a new version gets published
    // TODO: Clear old name/version pair when cache gets busted
    await this._ready;
    const key = `${name}@${version}`;
    if (this._cache[key] === undefined) {
      if (VERBOSE) {
        console.log(`Getting publish times for ${name}`);
      }
      const versions = await getPackageVersions(name);
      const rawTimes = await getPackagePublishTimes(name);
      // Filter out non-versions ("created"/"modified"/unpublished versions)
      this._cache[key] = versions.reduce((obj, v) => {
        obj[v] = rawTimes[v];
        return obj;
      }, {});
    }
    return this._cache[key];
  }
}

async function validateVersions(name, versions, pkgDataCache) {
  const filtered = [];
  for (let v of versions) {
    try {
      if (!semver.valid(v, true) || semver.prerelease(v, true) || await pkgDataCache.get(name, v) === undefined) {
        continue;
      }
    } catch {
      continue;
    }
    filtered.push(v);
  }
  return filtered;
}



module.exports = {
  searchRepo,
  searchExtensions,
  fetchPackageMetadata,
  getPackagePublishTimes,
  CachedPackageData,
  CachedPublishTimes,
  validateVersions,
}
