const mapDBToModel = ({ 
    id,
    title,
    year,
    genre, 
    performer,
    duration,
    created_at,
    updated_at,
    album_id
  }) => ({
    id,
    title,
    year,
    genre, 
    performer,
    duration,
    createdAt: created_at,
    updatedAt: updated_at,
    albumId: album_id
  });

  module.exports = { mapDBToModel };