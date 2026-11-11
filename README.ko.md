# Loopuff

[简体中文](README.zh.md) · [繁體中文](README.zh-Hant.md) · [English](README.md) · [Deutsch](README.de.md) · [Español](README.es.md) · [Français](README.fr.md) · [Tiếng Việt](README.vi.md) · [Русский](README.ru.md) · [Українська](README.uk.md) · [العربية](README.ar.md) · [日本語](README.ja.md) · [한국어](README.ko.md)

게임으로 프로그래밍과 Tolang을 배웁니다.

코드를 읽고 결과를 예측한 뒤 수정해 보세요. 마지막에는 예시 없이 새로운 문제를 해결합니다.

[shixilin.com/games/loopuff](https://shixilin.com/games/loopuff/ko/)

[금고 작전](https://shixilin.com/games/loopuff/ko/play/vault/)에는 이어지는 세 개의 장치가 있습니다. 계산으로 잠금을 풀고 이름을 사용한 뒤 신호를 순서대로 보내세요. 새 단서로 다시 도전할 수 있으며 코드와 세 개의 스탬프가 저장됩니다.

[우주항 배송 관제](https://shixilin.com/games/loopuff/ko/play/dispatch/): 조건문, 반복문, 함수, 서로 협력하는 메시지로 화물 경로를 정하세요. 새 라운드마다 새 배송 데이터가 주어집니다.

[은행 잠입](https://shixilin.com/games/loopuff/ko/play/heist/): 순찰을 읽고 가방을 빼내는 전략을 작성하세요. 모든 판단이 끊김 없이 이어지는 진행을 바꿉니다.

## 현재 코드

13개의 미션에서 프로그래밍 기초와 Tolang의 조건문, 반복문, 함수와 응답을 배우고, 이어서 메시지와 결합 수신을 다룹니다. 각 미션에는 예측, 설명, 수정, 독립 과제가 포함되며, 처음 네 개의 미션에는 비행 연습도 유지되어 있습니다. 강좌와 인터페이스는 11개 언어를 지원합니다. 프로그램은 완전한 Tolang 컴파일러나 TVM이 아니라, 기능과 실행 범위가 제한된 학습용 인터프리터에서 로컬로 실행됩니다. 독립 과제는 실제 출력과 함께, 요구된 개념이 그 출력을 만드는 데 사용되었는지 확인합니다. 타자 속도는 성적에 영향을 주지 않습니다.

독립 코딩 문제는 실행, 출력, 문제 조건을 100점 만점으로 평가해요. 수정 후 다시 제출할 수 있으며 타자 속도나 예시와의 일치 여부는 점수에 반영하지 않아요.

네 번째 미션에서는 프로그램의 출력으로 비행기이 뛰는 거리를 정합니다. 실행 후 착지 지점을 보고 계산을 바꿔 떠 있는 섬에 도착해 보세요.

## 개발

```sh
npm test
npm run build
npm run dev
```

## 언어 규칙

화면, 수업, 문제, 힌트, 오류는 선택한 언어로 표시합니다. 중국어 간체에서는 环灵, 번체에서는 環靈, 다른 언어에서는 Loopuff를 사용합니다. 코드 식별자와 기호는 번역하지 않습니다. 아랍어는 오른쪽에서 왼쪽으로, 코드는 왼쪽에서 오른쪽으로 표시합니다.

## 라이선스

[PolyForm Noncommercial 1.0.0](LICENSE)

PolyForm Noncommercial 1.0.0. 상업적 사용에는 별도의 서면 허가가 필요합니다.

개발: Shixi Lin.
