import {test,expect} from '@playwright/test';
import {SignJWT,exportJWK,generateKeyPair,createLocalJWKSet} from 'jose';
import {verifyAccessJwt,AccessDenied,requireAdmin} from '../admin/src/lib/access';

const TEAM='lepakmamak', AUD='aud-tag-123', EMAIL='yusufmohdsuhair@gmail.com';
const ISS=`https://${TEAM}.cloudflareaccess.com`;

async function harness(){
 const {publicKey,privateKey}=await generateKeyPair('RS256');
 const jwk=await exportJWK(publicKey); jwk.kid='k1'; jwk.alg='RS256';
 const jwks=createLocalJWKSet({keys:[jwk]});
 const sign=(claims:Record<string,unknown>,opts:{iss?:string;aud?:string;exp?:string}={})=>
  new SignJWT(claims)
   .setProtectedHeader({alg:'RS256',kid:'k1'})
   .setIssuer(opts.iss??ISS).setAudience(opts.aud??AUD)
   .setIssuedAt().setExpirationTime(opts.exp??'5m').sign(privateKey);
 return {jwks,sign};
}
const opts=(jwks:any)=>({teamDomain:TEAM,aud:AUD,allowedEmail:EMAIL,jwks});

test('a valid Access token for the admin email is accepted',async()=>{
 const {jwks,sign}=await harness();
 const identity=await verifyAccessJwt(await sign({email:EMAIL}),opts(jwks));
 expect(identity).toEqual({email:EMAIL});
});

test('tokens that are not the admin are rejected',async()=>{
 const {jwks,sign}=await harness();
 await expect(verifyAccessJwt(await sign({email:'someone@else.com'}),opts(jwks))).rejects.toThrow(AccessDenied);
 await expect(verifyAccessJwt(await sign({}),opts(jwks))).rejects.toThrow(AccessDenied);
 await expect(verifyAccessJwt(await sign({email:EMAIL.toUpperCase()}),opts(jwks))).resolves.toEqual({email:EMAIL});
});

test('wrong audience, wrong issuer, expiry and junk are rejected',async()=>{
 const {jwks,sign}=await harness();
 await expect(verifyAccessJwt(await sign({email:EMAIL},{aud:'other'}),opts(jwks))).rejects.toThrow();
 await expect(verifyAccessJwt(await sign({email:EMAIL},{iss:'https://evil.cloudflareaccess.com'}),opts(jwks))).rejects.toThrow();
 await expect(verifyAccessJwt(await sign({email:EMAIL},{exp:'-1m'}),opts(jwks))).rejects.toThrow();
 await expect(verifyAccessJwt('not-a-jwt',opts(jwks))).rejects.toThrow();
});

test('requireAdmin refuses a request with no Access header',async()=>{
 await expect(requireAdmin(new Request('https://admin.test/'))).rejects.toThrow(AccessDenied);
});
