export const heistStarter=`sync fn decide(distance, guard, facing, cover, alarm, energy, phase) {
 if phase == 3 then { return 1 };
 if distance > 3 then { return 1 };
 if distance < -3 then { return 5 };
 return 4
}`;
// One readable policy, not an answer matcher. Other valid programs are welcome.
export const heistExample=`sync fn decide(distance, guard, facing, cover, alarm, energy, phase) {
 if cover and energy < 30 then { return 3 };
 if cover and guard > -4 and guard < 40 and facing < 0 then { return 3 };
 if cover and guard < 4 and guard > -36 and facing > 0 then { return 3 };
 if guard > 0 and guard < 34 then {
  if facing < 0 then { return 5 } else { return 2 }
 };
 if guard < 0 and guard > -36 and facing > 0 then { return 6 };
 if phase == 3 then { return 1 };
 if distance > 3 then { return 1 };
 if distance < -3 then { return 5 };
 return 4
}`;
