const test = require('ava')
const depthLimit = require('./index')
const {
  buildSchema,
  Source,
  parse,
  validate,
  specifiedRules
} = require('graphql')


function createDocument(query) {
  const source = new Source(query, 'GraphQL request')
  return parse(source)
}

const petMixin = `
  name: String!
  owner: Human!
`

const schema = buildSchema(`
  type Query {
    user(name: String): Human
    version: String
    user1: Human
    user2: Human
    user3: Human
  }

  type Human {
    name: String!
    email: String!
    address: Address
    pets: [Pet]
  }

  interface Pet {
    ${petMixin}
  }

  type Cat {
    ${petMixin}
  }

  type Dog {
    ${petMixin}
  }

  type Address {
    street: String
    number: Int
    city: String
    country: String
  }
`)

test('should count depth without fragment', t => {
  const query = `
    query read0 {
      version
    }
    query read1 {
      version
      user {
        name
      }
    }
    query read2 {
      matt: user(name: "matt") {
        email
      }
      andy: user(name: "andy") {
        email
        address {
          city
        }
      }
    }
    query read3 {
      matt: user(name: "matt") {
        email
      }
      andy: user(name: "andy") {
        email
        address {
          city
        }
        pets {
          name
          owner {
            name
          }
        }
      }
    }
  `
  const document = createDocument(query)
  const expect = {
    read0: 0,
    read1: 1,
    read2: 2,
    read3: 3
  }
  t.plan(2)
  const spec = depths => t.deepEqual(expect, depths)
  const errors = validate(schema, document, [ ...specifiedRules, depthLimit(10, {}, spec) ])
  t.deepEqual([], errors)
})

test('should count with fragments', t => {
  const query = `
    query read0 {
      ... on Query {
        version
      }
    }
    query read1 {
      version
      user {
        ... on Human {
          name
        }
      }
    }
    fragment humanInfo on Human {
      email
    }
    fragment petInfo on Pet {
      name
      owner {
        name
      }
    }
    query read2 {
      matt: user(name: "matt") {
        ...humanInfo
      }
      andy: user(name: "andy") {
        ...humanInfo
        address {
          city
        }
      }
    }
    query read3 {
      matt: user(name: "matt") {
        ...humanInfo
      }
      andy: user(name: "andy") {
        ... on Human {
          email
        }
        address {
          city
        }
        pets {
          ...petInfo
        }
      }
    }
  `
  const document = createDocument(query)
  const expect = {
    read0: 0,
    read1: 1,
    read2: 2,
    read3: 3
  }
  t.plan(2)
  const spec = depths => t.deepEqual(expect, depths)
  const errors = validate(schema, document, [ ...specifiedRules, depthLimit(10, {}, spec) ])
  t.deepEqual([], errors)
})

test('should ignore the introspection query', t => {
  const document = createDocument(introQuery)
  t.plan(1)
  const errors = validate(schema, document, [ ...specifiedRules, depthLimit(5) ])
  t.deepEqual([], errors)
})

test('should catch a query thats too deep', t => {
  const query = `{
    user {
      pets {
        owner {
          pets {
            owner {
              pets {
                name
              }
            }
          }
        }
      }
    }
  }`
  t.plan(2)
  const document = createDocument(query)
  const errors = validate(schema, document, [ ...specifiedRules, depthLimit(4) ])
  t.is(1, errors.length)
  t.deepEqual("'' exceeds maximum operation depth of 4", errors[0].message)
})

test('should ignore a field', t => {
  const query = `
    query read1 {
      user { address { city } }
    }
    query read2 {
      user1 { address { city } }
      user2 { address { city } }
      user3 { address { city } }
    }
  `
  const document = createDocument(query)
  const options = {
    ignore: [
      'user1',
      /user2/,
      fieldName => fieldName === 'user3'
    ]
  }
  const expect = {
    read1: 2,
    read2: 0
  }
  t.plan(2)
  const spec = depths => t.deepEqual(expect, depths)
  const errors = validate(schema, document, [ ...specifiedRules, depthLimit(10, options, spec) ])
  t.deepEqual([], errors)
})

const introQuery = `
  query IntrospectionQuery {
    __schema {
      queryType { name }
      mutationType { name }
      subscriptionType { name }
      types {
        ...FullType
      }
      directives {
        name
        description
        locations
        args {
          ...InputValue
        }
      }
    }
  }

  fragment FullType on __Type {
    kind
    name
    description
    fields(includeDeprecated: true) {
      name
      description
      args {
        ...InputValue
      }
      type {
        ...TypeRef
      }
      isDeprecated
      deprecationReason
    }
    inputFields {
      ...InputValue
    }
    interfaces {
      ...TypeRef
    }
    enumValues(includeDeprecated: true) {
      name
      description
      isDeprecated
      deprecationReason
    }
    possibleTypes {
      ...TypeRef
    }
  }

  fragment InputValue on __InputValue {
    name
    description
    type { ...TypeRef }
    defaultValue
  }

  fragment TypeRef on __Type {
    kind
    name
    ofType {
      kind
      name
      ofType {
        kind
        name
        ofType {
          kind
          name
          ofType {
            kind
            name
            ofType {
              kind
              name
              ofType {
                kind
                name
                ofType {
                  kind
                  name
                }
              }
            }
          }
        }
      }
    }
  }
`

