const { ApolloServer, gql, UserInputError } = require('apollo-server')

const mongoose = require('mongoose')
const Author = require('./models/author')
const Book = require('./models/book')

mongoose.set('useFindAndModify', false)

const MONGODB_URI = 'mongodb+srv://phonebook_usr:Ph0n3b00k@cluster0.d4oax.mongodb.net/phonebook?retryWrites=true&w=majority'

console.log('connecting to MongoDB...')

mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true, useFindAndModify: false, useCreateIndex: true })
  .then(() => {
    console.log('connected to MongoDB')
  })
  .catch((error) => {
    console.log('error connection to MongoDB:', error.message)
  })

const JWT_SECRET = 'NEED_HERE_A_SECRET_KEY'

// begin
const typeDefs = gql`
  type Author {
    name: String!
    born: Int
    bookCount: Int!
    id: ID!
  }

  type Book {
    title: String!
    published: Int!
    author: Author!
    genres: [String!]!
    id: ID!
  }

  type User {
    username: String!
    favoriteGenre: String!
    id: ID!
  }

  type Token {
    value: String!
  }

  type Query {
    bookCount: Int!
    allBooks(author: String, genre: String): [Book!]!
    authorCount: Int!
    allAuthors: [Author!]!
    me: User
  }

  type Mutation {
    addBook(
      title: String!
      published: Int!
      author: String!
      genres: [String]!
    ): Book
    editAuthor(
      name: String!
      setBornTo: Int!
    ): Author
      createUser(
      username: String!
      favoriteGenre: String!
    ): User
    login(
      username: String!
      password: String!
    ): Token
  }
`

const resolvers = {
  Query: {
    bookCount: () => Book.collection.countDocuments(),
    allBooks: async (root, args) => {
      // const author = await Author.findOne({ name: args.author })
      // if (args.author) {
      //   const books = await Book.find({
      //     $and: [
      //       { author: { $in: author._id } }
      //     ]
      //   })

      //   return books
      // }

      if (args.genre) {
        const books = await Book.find({
          $and: [
            { genres: { $in: args.genre } }
          ]
        })

        return books
      }

      const books = await Book.find({})
      return books
    },
    authorCount: () => Author.collection.countDocuments(),
    allAuthors: () => Author.find({}),
    me: (root, args, context) => {
      return context.currentUser
    }
  },
  Author: {
    bookCount: (root) => {
      count = books.filter((book) => book.author === root.name)
      return count.length
    }
  },
  Book: {
    author: async (root) => {
      return await Author.findOne({ name: root.author})
    }
  },
  Mutation: {
    addBook: async (root, args, { currentUser }) => {
      if (!currentUser) {
        throw new AuthenticationError("not authenticated")
      }

      try {        
        const author = await Author.findOne({ name: args.author })

        if (!author) {
          const author = new Author({
            name: args.author,            
          })
          const savedAuthor = await author.save()
          
          const book = new Book({ ...args, author: savedAuthor._id })
          const savedBook = await book.save()
          return savedBook
        }
        
        const book = new Book({ ...args, author: author._id })
        const savedBook = await book.save()
        return savedBook

      } catch (error) {
        throw new UserInputError(error.message, {
          invalidArgs: args
        })
      }
    },
    editAuthor: async (root, args, { currentUser }) => {
      if (!currentUser) {
        throw new AuthenticationError("not authenticated")
      }

      const author =  await Author.findOne({ name: args.name })
      if (!author) return null

      const updatedAuthor = await Author.findByIdAndUpdate(
        id, { born: args.setBornTo }, { new: true }
      )
      return updatedAuthor
    },
    createUser: (root, args) => {
      try {
        const user = new User({ username: args.username }) 
        return user.save()
        
      } catch (error) {
        throw new UserInputError(error.message, {
          invalidArgs: args,
        })
      }
    },
    login: async (root, args) => {
      const user = await User.findOne({ username: args.username })
    
      if(!user || args.password !== 'secred' ) {
        throw new UserInputError('wrong credentials')
      }

      const userForToken = {
        username: user.username,
        id: user._id
      }

      return { value: jwt.sign(userForToken), JWT_SECRET }
    }
  }
}

const server = new ApolloServer({
  typeDefs,
  resolvers,
  context: async ({ req }) => {
    const auth = req ? req.headers.authorization : null
    if (auth && auth.toLowerCase().startsWith('bearer ')) {
      const decodedToken = jwt.verify(
        auth.substring(7), JWT_SECRET
      )
      const currentUser = await User.findById(decodedToken.id)
      return { currentUser }
    }
  }
})

server.listen().then(({ url }) => {
  console.log(`Server ready at ${url}`)
})