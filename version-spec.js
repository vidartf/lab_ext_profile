
/**
 * Used to determine which version of lab an extension supports
 */
const canaries = [
  '@jupyterlab/application',
  '@jupyterlab/coreutils',
  '@jupyterlab/rendermime-interfaces',
  '@jupyterlab/services',
  '@jupyter-widgets/base',
];


/**
 * Used to determine which version is the last an outdated extension supported:
 */
const mapKnownOld = {
  '0': {
    '@jupyterlab/application': '<1',
    '@jupyterlab/coreutils': '<3',
    '@jupyterlab/rendermime-interfaces': '<1.3',
    '@jupyterlab/services': '<4',
    '@jupyter-widgets/base': '^1'
  },

  '1': {
    '@jupyterlab/application': '^1',
    '@jupyterlab/coreutils': '^3',
    '@jupyterlab/rendermime-interfaces': '^1.3',
    '@jupyterlab/services': '^4',
    '@jupyter-widgets/base': '^2'
  },

  '2': {
    '@jupyterlab/application': '^2',
    '@jupyterlab/coreutils': '^4',
    '@jupyterlab/rendermime-interfaces': '^2',
    '@jupyterlab/services': '^5',
    '@jupyter-widgets/base': '^3'
  },
}

const oldVerKeys = Object.keys(mapKnownOld).sort().reverse();

module.exports = {
  canaries,
  mapKnownOld,
  oldVerKeys,
}
