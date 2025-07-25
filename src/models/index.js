// Export all collection-related models
export { default as Collection } from './Collection.js';
export { CollectionMember, CollectionMedia } from './CollectionRelations.js';
export { default as CollectionUtils } from './CollectionUtils.js';
export { default as Tag } from './Tag.js';
export { default as MediaItem } from './MediaItem.js';
export { default as Post } from './Post.js';
export { default as CommunityEvent } from './CommunityEvent.js';

// Re-export all models in a namespace for convenience
export const Models = {
  Collection: require('./Collection.js').default,
  Tag: require('./Tag.js').default,
  MediaItem: require('./MediaItem.js').default,
  Post: require('./Post.js').default,
  CommunityEvent: require('./CommunityEvent.js').default,
  CollectionMember: require('./CollectionRelations.js').CollectionMember,
  CollectionMedia: require('./CollectionRelations.js').CollectionMedia
};

// Re-export utilities
export const Utils = {
  Collection: require('./CollectionUtils.js').default
};
