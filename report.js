
const fs = require("fs").promises;


class ReportData {
  constructor(dateStr) {
    this.dateStr = dateStr;
    this._uptodate = [];
    this._outdated = {};
    this._unclassified = [];
    this._entries = [];
    this._labsupport = {};
  }

  add(packageData, labversion, uptodate) {
    const {name, version, dependencies, devDependencies, peerDependencies} = packageData;
    this._entries.push({
      name,
      version,
      labversion,
      uptodate,
      dependencies,
      devDependencies,
      peerDependencies,
    });
    if (uptodate) {
      this._uptodate.push(name);
    } else if (labversion === 'unclassified') {
      this._unclassified.push(name);
    } else {
      this._outdated[name] = labversion;
    }
  }

  get outdatedCounts() {
    return Object.keys(this._outdated).reduce((obj, key) => {
      obj[this._outdated[key]] = (obj[this._outdated[key]] || 0) + 1;
      return obj;
    }, {});
  }

  get labSupportCounts() {
    return this._entries.reduce((obj, entry) => {
      obj[entry.labversion] = (obj[entry.labversion] || 0) + 1;
      return obj;
    }, {}); 
  }

  get total() {
    return this._uptodate.length + Object.keys(this._outdated).length + this._unclassified.length;
  }

  report() {
    console.log(`Processed ${this.total} extensions:\n`)
    console.log(`Up to date (${this._uptodate.length})\n`);
    const outdatedCounts = this.outdatedCounts;
    const outdatedKeys = Object.keys(outdatedCounts).sort().reverse().filter(v => v !== 'unknown');
    console.log(`Outdated (${Object.keys(this._outdated).length}):\n  ${outdatedKeys.map(key => `Support ends at v${key}.x: ${outdatedCounts[key] || 0}`).join('\n  ')}`);
    if (outdatedCounts['unknown']) {
      console.log(`  Unknown last version supported: ${outdatedCounts['unknown']}\n`);
    }
    console.log(`Unclassified (${this._unclassified.length})\n`);
  }

  async save(filename, indent=null) {
    return fs.writeFile(filename, JSON.stringify({
      date: this.dateStr,
      extensions: this._entries,
      summary: {
        uptodateCount: this._uptodate.length,
        outdatedCount: this._outdated.length,
        outdatedCountCategorized: this.outdatedCounts,
        unclassified: this._unclassified,
        labSupportCounts: this.labSupportCounts
      }
    }, null, indent));
  }
}


module.exports = {
  ReportData,
}
