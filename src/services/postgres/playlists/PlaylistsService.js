const { Pool } = require("pg");
const { nanoid } = require("nanoid");
const InvariantError = require("../../../exceptions/InvariantError");
const { mapDBToPlaylist } = require("../../../utils/playlists");
const NotFoundError = require("../../../exceptions/NotFoundError");
const AuthorizationError = require("../../../exceptions/AuthorizationError");

class PlaylistsService {
  constructor(collaborationService) {
    this._pool = new Pool();
    this._collaborationService = collaborationService;
  }

  async addPlaylist({ name, owner }) {
    const id = `playlists-${nanoid(16)}`;

    const query = {
      text: "INSERT INTO playlists VALUES($1, $2, $3) RETURNING id",
      values: [id, name, owner],
    };

    const result = await this._pool.query(query);

    if (!result.rows) {
      throw new InvariantError("Playlist gagal ditambahkan");
    }

    return result.rows[0].id;
  }

  async getAllPlaylists(owner) {
    const query = {
      text: "SELECT playlists.id, playlists.name, users.username FROM playlists LEFT JOIN users ON users.id = playlists.owner WHERE playlists.owner = $1",
      values: [owner],
    };

    const result = await this._pool.query(query);

    const playlist = result.rows;
    return playlist;
  }

  async deletePlaylistById(id) {
    const query = {
      text: "DELETE FROM playlists WHERE id = $1 RETURNING id",
      values: [id],
    };

    const result = await this._pool.query(query);

    if (!result.rows.length) {
      throw new NotFoundError("Playlist gagal dihapus. Id tidak ditemukan");
    }
  }

  async verifyPlaylistOwner(id, owner) {
    const query = {
        text: "SELECT * FROM playlists WHERE id = $1",
        values: [id],
    };
    const result = await this._pool.query(query);

    if (!result.rows.length) {
        throw new NotFoundError("Playlist tidak ditemukan");
    }

    const playlist = result.rows[0];

    if (playlist.owner !== owner) {
        throw new AuthorizationError("Anda tidak memiliki akses resource ini");
    }
}


  async addSongPlaylist(playlistId, songId) {
    const id = `songPlaylist-` + nanoid(16);

    const query = {
      text: "INSERT INTO playlist_songs VALUES($1, $2, $3) RETURNING id",
      values: [id, playlistId, songId],
    };
    const result = await this._pool.query(query);

    if (!result.rows.length) {
      throw new InvariantError("Gagal menambahkan Playlist Song");
    }
  }
  async getSongPlaylistById(playlistId) {
    const queryPlaylist = {
      text: "SELECT playlists.id, playlists.name, users.username FROM playlists INNER JOIN users ON playlists.owner = users.id WHERE playlists.id = $1",
      values: [playlistId],
    };
    const playlistResult = await this._pool.query(queryPlaylist);

    if (playlistResult.rows.length === 0) {
      throw new NotFoundError("Playlist tidak ditemukan");
    }

    const querySong = {
      text: "SELECT songs.id, songs.title, songs.performer FROM songs LEFT JOIN playlist_songs ON playlist_songs.song_id = songs.id WHERE playlist_songs.playlist_id = $1",
      values: [playlistId],
    };

    const songResult = await this._pool.query(querySong);

    const playlist = playlistResult.rows[0];

    return {
      id: playlist.id,
      name: playlist.name,
      username: playlist.username,
      songs: songResult.rows,
    };
  }

  async deleteSongPlaylistById(playlistId, songId) {
    const query = {
      text: "DELETE FROM playlist_songs WHERE playlist_id = $1 AND song_id = $2 RETURNING id",
      values: [playlistId, songId],
    };

    const result = await this._pool.query(query);

    if (!result.rows.length) {
      throw new InvariantError("Playlist Song gagal dihapus. Id tidak ditemukan");
    }
  }

  async addActivitiesPlaylist(playlistId, songId, userId, action) {
    const id = `activity-${nanoid(16)}`;
    const time = new Date().toISOString();

    const query = {
      text: "INSERT INTO playlist_song_activities VALUES($1, $2, $3, $4, $5, $6) RETURNING id",
      values: [id, playlistId, songId, userId, action, time],
    };

    const result = await this._pool.query(query);

    if (!result.rows.length) {
      throw new InvariantError("Gagal menambahkan activity");
    }
  }

  async getPlaylistActivityById(playlistId) {
    const query = {
      text: "SELECT users.username, songs.title, playlist_song_activities.action, playlist_song_activities.time FROM playlist_song_activities INNER JOIN songs ON playlist_song_activities.song_id = songs.id INNER JOIN users ON playlist_song_activities.user_id = users.id WHERE playlist_song_activities.playlist_id = $1 ORDER BY playlist_song_activities.time ASC",
      values: [playlistId],
    };

    const result = await this._pool.query(query);
    return result.rows;
  }

  async verifyPlaylistAccess(playlistId, userId) {
    try {
      await this.verifyPlaylistOwner(playlistId, userId);
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }

      try {
        await this._collaborationService.verifyCollaborator(playlistId, userId);
      } catch {
        throw error;
      }
    }
  }
}

module.exports = PlaylistsService;
