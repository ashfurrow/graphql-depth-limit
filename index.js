const {
  GraphQLError,
  Kind
} = require('graphql')

module.exports = (maxDepth, callback) => validationContext => {
  try {
    const { definitions } = validationContext.getDocument()
    const fragments = getFragments(definitions)
    const queries = getQueriesAndMutations(definitions)
    const queryDepths = {}
    for (let name in queries) {
      queryDepths[name] = determineDepth(queries[name], fragments, 0, maxDepth, validationContext, name)
    }
    callback && callback(queryDepths)
    return validationContext
  } catch (err) {
    console.error(err)
    throw err
  }
}

function getFragments(definitions) {
  return definitions.reduce((map, definition) => {
    if (definition.kind === Kind.FRAGMENT_DEFINITION) {
      map[definition.name.value] = definition
    }
    return map
  }, {})
}

// this will actually get both queries and mutations. we can basically treat those the same
function getQueriesAndMutations(definitions) {
  return definitions.reduce((map, definition) => {
    if (definition.kind === Kind.OPERATION_DEFINITION) {
      map[definition.name ? definition.name.value : ''] = definition
    }
    return map
  }, {})
}

function determineDepth(node, fragments, depthSoFar, maxDepth, context, operationName) {
  if (depthSoFar > maxDepth) {
    return context.reportError(new GraphQLError(`'${operationName}' exceeds maximum operation depth of ${maxDepth}`, [ node ]))
  }
  switch (node.kind) {
    case Kind.FIELD:
      if (!node.selectionSet) {
        return 0
      } else {
        return 1 + Math.max(...node.selectionSet.selections.map(selection => determineDepth(selection, fragments, depthSoFar + 1, maxDepth, context, operationName)))
      }
    case Kind.FRAGMENT_SPREAD:
      return determineDepth(fragments[node.name.value], fragments, depthSoFar, maxDepth, context, operationName)
    case Kind.INLINE_FRAGMENT:
    case Kind.FRAGMENT_DEFINITION:
    case Kind.OPERATION_DEFINITION:
      return Math.max(...node.selectionSet.selections.map(selection => determineDepth(selection, fragments, depthSoFar, maxDepth, context, operationName)))
    default:
      throw new Error('uh oh! depth crawler cannot handle: ' + node.kind)
  }
}

