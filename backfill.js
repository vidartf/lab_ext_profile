/**
 * This script queries npm for all packages with the "jupyterlab-extension"
 * keyword, and inspects them to determine which version of jupyterlab they
 * support.
 */

const fs = require("fs").promises;
const path = require("path");
const semver = require('semver');

const {
  searchExtensions,
  validateVersions,
  getPackagePublishTimes,
  CachedPackageData,
  CachedPublishTimes
} = require('./scrapers');

const {
  ReportData,
} = require('./report');

const {
  minNumeric
} = require('./utils');

const {
  canaries,
  mapKnownOld,
  oldVerKeys,
} = require('./version-spec');

const outputDir = './profile';

// Start at release of Jupyterlab 0.31.0
const start = new Date(2018, 0, 11);
const stop = new Date();

// The rate at which to sample the extension state, in days
const sampleRate = 7


const pkgDataCache = new CachedPackageData('./_pkgDataCache.json');
const pkgTimesCache = new CachedPublishTimes('./_pkgTimesCache.json');


async function main() {
  // First gather up all the extensions know at current date
  let exts = [];
  let page = 0;
  let res = searchExtensions('', page);
  while ((await res).objects.length > 0) {
    exts.push(...(await res).objects);
    // Start new search:
    res = searchExtensions('', ++page);
  }

  try {
    await fs.mkdir(outputDir, {recursive: true});
  } catch {
    // Ignore if already exists
  }

  // Resolve latest version dynamically
  const canaryTimes = {};
  const canaryVersions = {};
  for (let c of canaries) {
    canaryTimes[c] = await getPackagePublishTimes(c);
    canaryVersions[c] = semver.sort(
      await validateVersions(c, Object.keys(canaryTimes[c]), pkgDataCache),
      true
    ).reverse();
  }
  

  // Loop through dates:
  let date = new Date(start);
  while (date <= stop) {

    const dateStr = date.toISOString().substr(0, 10);
    console.log(`Processing ${dateStr}`);

    // Resolve latest version dynamically
    const mapKnown = {};
    for (let c of canaries) {
      const version = canaryVersions[c].find(v => {
        return new Date(canaryTimes[c][v]) < date;
      });
      mapKnown[c] = `^${version}`;
    }

    const report = new ReportData(dateStr);

    await Promise.all(exts.map(async (obj) => {
      const pkg = obj.package;
      const times = await pkgTimesCache.get(pkg.name, pkg.version);
      const versions = semver.sort(
        await validateVersions(pkg.name, Object.keys(times), pkgDataCache),
        true
      ).reverse();
      const version = versions.find(v => {
        return semver.lte(v, pkg.version, true) && new Date(times[v]) < date;
      });
      if (version === undefined) {
        return;
      }
      if (pkg.keywords.indexOf('deprecated') >= 0) {
        // Ignore deprecated packages.
        return;
      }
      let data;
      try {
        data = await pkgDataCache.get(pkg.name, version);
      } catch (err) {
        console.log(`Failed to fetch data for ${pkg.name}@${version}`);
        report.add(pkg, 'unclassified', false);
        throw err;
      }

      const deps = {
        ...(data.dependencies || {}),
        ...(data.peerDependencies || {}),
        ...(data.devDependencies || {}),
      }

      let labversion = null;
      let uptodate = null;
      for (let key of Object.keys(mapKnown)) {
        if (deps[key] !== undefined) {
          let indicatedUptodate = deps[key] === 'latest' || semver.intersects(mapKnown[key], deps[key], true);
          uptodate = uptodate === null ? indicatedUptodate : uptodate && indicatedUptodate;
          for (let oldVer of oldVerKeys) {
            if (mapKnownOld[oldVer][key] !== undefined && (
              deps[key] === 'latest' || semver.intersects(mapKnownOld[oldVer][key], deps[key], true
            ))) {
              labversion = labversion === null ? oldVer : minNumeric(oldVer, labversion);
              break;
            }
          }
        }
      }
      report.add(pkg, labversion === null ? 'unclassified' : labversion, uptodate === true);
    }));

    report.report();
    await report.save(path.join(outputDir, report.dateStr + '.json'), 1);
    
    // Rolls over:
    date.setDate(date.getDate() + sampleRate);
  }
}

main()
  .then(() => {
    pkgDataCache.save();
    pkgTimesCache.save();
  })
  .catch(err => {
    console.log(err);
    pkgDataCache.save();
    pkgTimesCache.save();
  });
