/**
 * sldSymbols.js
 * JointJS Custom Shapes Definition for Power System SLD (Entry & Namespace Initializer)
 *
 * 세부 심볼 정의는 아래 카테고리별 모듈에 분리되어 있습니다:
 * - symbols/substation.js: 수전 및 변전 설비 (송전철탑, 변압기 TR, 피뢰기 LA, 단로기 DS)
 * - symbols/breakers.js: 차단기 및 보호 설비 (VCB, GCB, ACB, MCCB, 타이 차단기, 퓨즈, 계전기, CT, PT, 접지단로기)
 * - symbols/powerSources.js: 전원/부하 설비 (발전기, 모터, 부하, UPS, 정류기, 배터리, 대지접지)
 * - symbols/distribution.js: 배전 및 도면요소 (모선 Busbar, 배전반, 분전반, 분기점 Junction, 주석, 점선 박스)
 * - symbols/router.js: CAD 직교 라우터(sldOrthogonal) 및 점프 아크 커넥터(sldJumpover)
 */
(function () {
  if (typeof joint === "undefined") return;
  joint.shapes.sld = joint.shapes.sld || {};
})();
