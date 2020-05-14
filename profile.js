/**
 * This script queries npm for all packages with the "jupyterlab-extension"
 * keyword, and inspects them to determine which version of jupyterlab they
 * support.
 */

const semver = require('semver');

const {
  searchExtensions,
  fetchPackageMetadata,
  CachedPackageData,
} = require('./scrapers');

const {
  ReportData,
} = require('./report');

const {
  minNumeric,
  VERBOSE
} = require('./utils');

const {
  canaries,
  mapKnownOld,
  oldVerKeys,
} = require('./version-spec');



const pkgDataCache = new CachedPackageData('./_pkgDataCache.json');

const dateStr = (new Date()).toISOString().substr(0, 10);
const outputFilepath = `./profile/${dateStr}.json`;


async function main() {

  // Resolve latest version dynamically
  const mapKnown = {};
  for (let c of canaries) {
    let data = await fetchPackageMetadata(c);
    mapKnown[c] = `^${data["dist-tags"]["latest"]}`;
  }

  const report = new ReportData(dateStr);

  let page = 0;
  let res = searchExtensions('', page);
  while ((await res).objects.length > 0) {
    let objects = (await res).objects;
    // Start new search async:
    res = searchExtensions('', ++page);
    for (let obj of objects) {
      const pkg = obj.package;
      if (pkg.keywords.indexOf('deprecated') >= 0) {
        // Ignore deprecated packages.
        continue;
      }
      const data = await pkgDataCache.get(pkg.name, pkg.version);

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
      if (VERBOSE && labversion === null) {
        console.log(`Could not classify ${pkg.name}:`);
        console.log(deps);
        console.log('\n');
      }
      report.add(pkg, labversion === null ? 'unclassified' : labversion, uptodate === true);
    }
  }

  report.report();

  try {
    await fs.mkdir(path.dirname(outputFilepath), {recursive: true});
  } catch {
    // Ignore if already exists
  }
  await report.save(outputFilepath);
}

main()
  .then(() => {
    pkgDataCache.save();
  })
  .catch(err => {
    console.log(err);
    pkgDataCache.save();
  });
