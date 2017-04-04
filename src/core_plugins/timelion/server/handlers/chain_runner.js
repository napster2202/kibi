
const _ = require('lodash');
const glob = require('glob');
const Promise = require('bluebird');

const parseSheet = require('./lib/parse_sheet.js');
const parseDateMath = require('../lib/date_math.js');
const calculateInterval = require('../../public/lib/calculate_interval.js');

const repositionArguments = require('./lib/reposition_arguments.js');
const indexArguments = require('./lib/index_arguments.js');
const validateTime = require('./lib/validate_time.js');

const loadFunctions = require('../lib/load_functions.js');
const fitFunctions  = loadFunctions('fit_functions');

module.exports = function (tlConfig) {
  const preprocessChain = require('./lib/preprocess_chain')(tlConfig);

  let queryCache = {};
  const stats = {};
  let sheet;

  function getQueryCacheKey(query) {
    return JSON.stringify(_.omit(query, 'label'));
  }

  function throwWithCell(cell, exception) {
    throw new Error(' in cell #' + (cell + 1) + ': ' + exception.message);
  }

  // Invokes a modifier function, resolving arguments into series as needed
  function invoke(fnName, args) {
    const functionDef = tlConfig.server.plugins.timelion.getFunction(fnName);

    function resolveArgument(item) {
      if (_.isArray(item)) {
        return Promise.all(_.map(item, resolveArgument));
      }

      if (_.isObject(item)) {
        switch (item.type) {
          case 'function':
            var itemFunctionDef = tlConfig.server.plugins.timelion.getFunction(item.function);
            if (itemFunctionDef.cacheKey && queryCache[itemFunctionDef.cacheKey(item)]) {
              stats.queryCount++;
              return Promise.resolve(_.cloneDeep(queryCache[itemFunctionDef.cacheKey(item)]));
            }
            return invoke(item.function, item.arguments);
          case 'reference':
            var reference;
            if (item.series) {
              reference = sheet[item.plot - 1][item.series - 1];
            } else {
              reference = {
                type: 'chainList',
                list: sheet[item.plot - 1]
              };
            }
            return invoke('first', [reference]);
          case 'chain':
            return invokeChain(item);
          case 'chainList':
            return resolveChainList(item.list);
          case 'literal':
            return item.value;
          case 'requestList':
          case 'seriesList':
            return item;
        }
        throw new Error ('Argument type not supported: ' + JSON.stringify(item));
      } else {
        return item;
      }
    }

    args = repositionArguments(functionDef, args);

    args = _.map(args, resolveArgument);

    return Promise.all(args).then(function (args) {
      args.byName = indexArguments(functionDef, args);
      return functionDef.fn(args, tlConfig);
    });
  }

  function invokeChain(chainObj, result) {
    if (chainObj.chain.length === 0) return result[0];

    const chain = _.clone(chainObj.chain);
    const link = chain.shift();

    let promise;
    if (link.type === 'chain') {
      promise = invokeChain(link);
    } else if (!result) {
      promise = invoke('first', [link]);
    } else {
      const args = link.arguments ? result.concat(link.arguments) : result;
      promise = invoke(link.function, args);
    }

    return promise.then(function (result) {
      return invokeChain({type:'chain', chain: chain}, [result]);
    });

  }

  function resolveChainList(chainList) {
    const seriesList = _.map(chainList, function (chain) {
      const values = invoke('first', [chain]);
      return values.then(function (args) {
        return args;
      });
    });
    return Promise.all(seriesList).then(function (args) {
      const list = _.chain(args).pluck('list').flatten().value();
      const seriesList = _.merge.apply(this, _.flatten([{}, args]));
      seriesList.list = list;
      return seriesList;
    });
  }

  function preProcessSheet(sheet) {

    let queries = {};
    _.each(sheet, function (chainList, i) {
      try {
        const queriesInCell = _.mapValues(preprocessChain(chainList), function (val) {
          val.cell = i;
          return val;
        });
        queries = _.extend(queries, queriesInCell);
      } catch (e) {
        throwWithCell(i, e);
      }
    });
    queries = _.values(queries);

    const promises = _.chain(queries).values().map(function (query) {
      return invoke(query.function, query.arguments);
    }).value();

    return Promise.settle(promises).then(function (resolvedDatasources) {

      stats.queryTime = (new Date()).getTime();

      _.each(queries, function (query, i) {
        const functionDef = tlConfig.server.plugins.timelion.getFunction(query.function);
        const resolvedDatasource = resolvedDatasources[i];

        if (resolvedDatasource.isRejected()) {
          if (resolvedDatasource.reason().isBoom) {
            throw resolvedDatasource.reason();
          } else {
            throwWithCell(query.cell, resolvedDatasource.reason());
          }
        }

        queryCache[functionDef.cacheKey(query)] = resolvedDatasource.value();
      });

      stats.cacheCount = _.keys(queryCache).length;
      return sheet;
    });
  }

  function processRequest(request) {
    if (!request) throw new Error('Empty request body');

    validateTime(request.time, tlConfig);

    tlConfig.time = request.time;
    tlConfig.time.to = parseDateMath(request.time.to, true).valueOf();
    tlConfig.time.from = parseDateMath(request.time.from).valueOf();
    tlConfig.time.interval = calculateInterval(
      tlConfig.time.from,
      tlConfig.time.to,
      tlConfig.settings['timelion:target_buckets'] || 200,
      tlConfig.time.interval
    );

    tlConfig.setTargetSeries();

    stats.invokeTime = (new Date()).getTime();
    stats.queryCount = 0;
    queryCache = {};

    // This is setting the "global" sheet, required for resolving references
    sheet = parseSheet(request.sheet);
    return preProcessSheet(sheet).then(function () {
      return _.map(sheet, function (chainList, i) {
        return resolveChainList(chainList).then(function (seriesList) {
          stats.sheetTime = (new Date()).getTime();
          return seriesList;
        }).catch(function (e) {
          throwWithCell(i, e);
        });
      });
    });
  }

  return {
    processRequest: processRequest,
    getStats: function () { return stats; }
  };
};