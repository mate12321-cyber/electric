# ⚡ 전력 계통도 편집기 (Power System Single-Line Diagram Platform)

Django, HTMX, JointJS, 그리고 순수 CSS(Pure CSS)를 기반으로 구축된 **전문 전력 계통도(Single-Line Diagram, SLD) 웹 플랫폼**입니다.

---

## 🌟 주요 기능 (Features)

1. **설비 메타데이터 레지스트리 (24종 한국 표준 전기 심볼)**:
   - **수전 설비**: 송전철탑(154kV 수전), 2권선/3권선 변압기(TR), 가스차단기(GCB), 단로기(DS), 피뢰기(LA)
   - **보호/차단 설비**: 기중차단기(ACB), 진공차단기(VCB), 배선용차단기(MCCB), 파워퓨즈(PF), 계전기(OCR), 변류기(CT), 계기용변압기(PT), 접지단로기(ES)
   - **배전 설비**: 모선(Busbar), 배전반(Switchgear), 분전반(Panelboard), 모터(M), 일반부하(Load)
   - **전원 설비**: 무정전전원장치(UPS), 정류기/충전기, 배터리 뱅크(DC), 비상발전기(G)
   - **기타**: 대지접지(PE), 접속점(Node), 텍스트 주석, 영역 그룹 점선 박스
2. **실시간 토폴로지 분석기 & 전력 흐름 시각화 (BFS Graph Traversal)**:
   - 3단계 우선순위(접지 ➜ 통전 ➜ 정전) 상태 실시간 판정
   - 차단기/단로기 클릭 시 개폐(ON/OFF) 접점 회전 및 하위 계통 전력 흐름 애니메이션(Live Flow Dash)
3. **전문 CAD 캔버스 엔진 (JointJS)**:
   - 자동 직교 배선(Manhattan Router) 및 단자 포트 마그넷 스냅
   - 다중 탭 모선(Busbar) 및 가변 피더 연결
   - 마우스 우클릭/Space 드래그 패닝, 마우스 휠 줌(30% ~ 250%), 화면 맞춤
   - 실시간 미니맵(Minimap) 벡터 렌더러 및 내비게이션
   - Undo/Redo (Ctrl+Z, Ctrl+Y), 다중 삭제, 자동 저장
4. **속성 편집 패널 & HTMX 실시간 텔레메트리**:
   - 일반 / 스타일 / 데이터 3단 탭 속성 편집기
   - HTMX 10초 주기 비동기 폴링으로 실시간 전압(kV), 전류(A), 유효전력(MW), 무효전력(MVAR), 역률(%), 주파수(Hz) 모니터링
5. **고해상도 내보내기**:
   - PNG 고해상도 이미지, SVG 벡터 그래픽, JSON 다이어그램 스키마 내보내기/불러오기 지원

---

## 🛠️ 기술 스택 (Tech Stack)

- **Backend**: Python 3.14+, Django 6.x, SQLite (JSONField)
- **Frontend Interactivity**: JointJS v3.7, Lodash, Backbone, HTMX 2.x, Vanilla JS (ES6+)
- **Styling**: 100% Pure CSS (No Tailwind/Bootstrap dependencies, CAD-grade Dark/Light theme)

---

## 🚀 빠른 시작 (Quick Start)

```bash
# 1. 의존성 패키지 설치
pip install django pillow

# 2. 데이터베이스 마이그레이션 & 초기 시드 데이터 로드
python manage.py migrate
python -c "import django, os; os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'power_diagram.settings'); django.setup(); from sld.seed_data import init_default_diagram; init_default_diagram()"

# 3. 개발 서버 실행
python manage.py runserver 127.0.0.1:8000
```
