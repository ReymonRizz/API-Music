require('dotenv').config();

const Hapi = require("@hapi/hapi");
const Jwt = require('@hapi/jwt');

//Albums
const albums = require("./api/albums");
const AlbumsService = require("./services/postgres/albums/AlbumsService");
const AlbumsValidator = require("./validator/albums");

//Songs
const songs = require("./api/songs");
const SongsService = require("./services/postgres/songs/SongsService");
const SongsValidator = require("./validator/songs");

//Users
const users = require("./api/users")
const UsersService = require("./services/postgres/users/UsersService")
const UsersValidator = require("./validator/users")

//Collaborations
const collaborations = require("./api/collaborations");
const CollaborationsService = require("./services/postgres/collaborations/CollaborationsService")
const CollaborationsValidator = require("./validator/collaborations")

//Authentications
const authentications = require("./api/authentications")
const AuthenticationsService = require("./services/postgres/authentications/AuthenticationsService")
const TokenManager = require("./tokenize/TokenManager")
const AuthenticationsValidator = require("./validator/authentications")


//Playlists
const playlists = require("./api/playlists")
const PlaylistsService = require("./services/postgres/playlists/PlaylistsService")
const PlaylistsValidator = require("./validator/playlists")

const ClientError = require("./exceptions/ClientError");

const init = async () => {
  const collaborationsService = new CollaborationsService();
  const playlistsService = new PlaylistsService(collaborationsService);
  const albumsService = new AlbumsService();
  const songsService = new SongsService();
  const usersService = new UsersService();
  const authenticationsService = new AuthenticationsService()
  const server = Hapi.server({
    port: process.env.PORT,
    host: process.env.HOST,
    routes: {
      cors: {
        origin: ["*"],
      },
    },
  });

   // registrasi plugin eksternal
   await server.register([
    {
      plugin: Jwt,
    },
  ]);

   // mendefinisikan strategy autentikasi jwt
   server.auth.strategy('openmusicapi', 'jwt', {
    keys: process.env.ACCESS_TOKEN_KEY,
    verify: {
      aud: false,
      iss: false,
      sub: false,
      maxAgeSec: process.env.ACCESS_TOKEN_AGE,
    },
    validate: (artifacts) => ({
      isValid: true,
      credentials: {
        id: artifacts.decoded.payload.id,
      },
    }),
  });

  await server.register([
    {
      plugin: albums,
      options: {
        service: albumsService,
        validator: AlbumsValidator,
      },
    },
    {
      plugin: songs,
      options: {
        service: songsService,
        validator: SongsValidator,
      },
    },
    {
      plugin: users,
      options: {
        service: usersService,
        validator: UsersValidator,
      },
    },
    {
      plugin: authentications,
      options: {
        authenticationsService,
        usersService,
        tokenManager: TokenManager,
        validator: AuthenticationsValidator,
      },
    },
    {
      plugin: playlists,
      options: {
        service: playlistsService, songsService,
        validator: PlaylistsValidator,
      },
    },
    {
      plugin: collaborations,
      options: {
        collaborationsService,
        playlistsService,
        usersService,
        validator: CollaborationsValidator,
      },
    },
  ]);

  server.ext("onPreResponse", (request, h) => {
    const { response } = request;

    if (response instanceof ClientError) {
      const newResponse = h.response({
        status: "fail",
        message: response.message,
      });
      newResponse.code(response.statusCode);
      return newResponse;
    }

    return h.continue;
  });

  await server.start();
  console.log(`Server berjalan pada ${server.info.uri}`);
};

init();
