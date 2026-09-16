import breeds from './pet-breeds.json' with {type: 'json'};
import coats from './pet-coats.json' with {type: 'json'};

// Keep the existing metadata/network field; legacy breed IDs keep their original coat.
export function petStyle(value) {
  if (typeof value !== 'string') return null;
  const [breedId, coatId, extra] = value.trim().split(':');
  if (extra !== undefined) return null;
  const breed = breeds.find(item => item.id === breedId);
  const coat = coats.find(item => item.id === (coatId ?? breed?.coat));
  return breed && coat ? {...breed, ...coat, id: value.trim(), breedId: breed.id, coatId: coat.id, name: breed.name} : null;
}
