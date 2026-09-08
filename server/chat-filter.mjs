// Shared by all chat recipients: never broadcast the uncensored message.
// Keep whole-word boundaries so ordinary words (class, assistant, Scunthorpe) survive.
const words = [
 'fuck', 'fucker', 'fuckers', 'fucking', 'fucked', 'motherfucker', 'motherfuckers',
 'shit', 'shits', 'shitty', 'bullshit', 'bitch', 'bitches', 'bastard', 'bastards',
 'asshole', 'assholes', 'cunt', 'cunts', 'dick', 'dickhead', 'cock', 'pussy',
 'nigger', 'nigga', 'faggot',
 'sial', 'sialan', 'babi', 'bodo', 'bodoh', 'bangang', 'bangsat', 'bajingan',
 'celaka', 'cilaka', 'pukimak', 'puki', 'pantat', 'butoh', 'butuh', 'kontol',
 'kimak', 'lancau', 'lanciao', 'lanjiao', 'cibai', 'cipap', 'sohai', 'tahi',
];
const substitutions = { '@':'a', '4':'a', '0':'o', '1':'i', '!':'i', '3':'e', '$':'s', '5':'s', '7':'t', '8':'b' };
const patterns = words.map(word => new RegExp(`(?<![\\p{L}\\p{N}])${[...word].map(letter => `${letter}+`).join('[^\\p{L}\\p{N}]*')}(?![\\p{L}\\p{N}])`, 'u'));
export function filterChat(text) {
 const normalized = text.normalize('NFKC').toLowerCase().replace(/[\p{Cf}\p{M}]/gu, '').replace(/[@4013$578]/g, char => substitutions[char]);
 return patterns.some(pattern => pattern.test(normalized) || pattern.test(normalized.replace(/!/g, 'i'))) ? '***' : text;
}
