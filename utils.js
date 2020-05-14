
const process = require('process');

function minNumeric(a, b) {
  if (parseInt(a) < parseInt(b)) {
    return a;
  }
  return b;
}

const VERBOSE = typeof v8debug === 'object' 
  || /--debug|--inspect/.test(process.execArgv.join(' '))
  || /(--verbose|-v)(\s|$)/.test(process.argv.join(' '));

module.exports = {
  minNumeric,
  VERBOSE
};
