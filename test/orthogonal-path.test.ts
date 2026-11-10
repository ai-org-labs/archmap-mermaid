import {expect,it} from 'vitest';
import {roundedOrthogonalPath} from '../src/focused/orthogonal-path.js';
it('rounds corners without moving endpoints and clamps tiny segments',()=>{
 expect(roundedOrthogonalPath([{x:0,y:0},{x:20,y:0},{x:20,y:20}])).toBe('M 0 0 L 15 0 Q 20 0 20 5 L 20 20');
 const small=roundedOrthogonalPath([{x:0,y:0},{x:2,y:0},{x:2,y:2}]);expect(small).toBe('M 0 0 L 1 0 Q 2 0 2 1 L 2 2');
 expect(roundedOrthogonalPath([{x:0,y:0},{x:20,y:0}])).toBe('M 0 0 L 20 0');
 expect(roundedOrthogonalPath([])).toBe('');
});
