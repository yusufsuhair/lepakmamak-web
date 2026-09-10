import {test,expect} from '@playwright/test';
import {horizontalDistance,remoteIsVisible,remoteNeedsSnap} from '../src/remote-visibility';

test('remote visibility follows the authoritative target after a local teleport',()=>{
 const viewer={x:117,z:106};
 const target={x:119,z:106};
 const staleRendered={x:-31,z:112};
 expect(horizontalDistance(target,viewer)).toBe(2);
 expect(remoteIsVisible(target,viewer,110)).toBe(true);
 expect(remoteIsVisible(staleRendered,viewer,110)).toBe(false);
 expect(remoteNeedsSnap(staleRendered,target)).toBe(true);
});

test('ordinary nearby movement still uses smooth interpolation',()=>{
 expect(remoteNeedsSnap({x:10,z:10},{x:18,z:10})).toBe(false);
 expect(remoteNeedsSnap({x:10,z:10},{x:51,z:10})).toBe(true);
});
