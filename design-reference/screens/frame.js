/**
 * 디바이스 프레임 보조 스크립트.
 *
 * 화면 파일은 `.lf-device > .lf-device__viewport > .lf-screen` 만 작성하고,
 * 상태 표시줄과 제스처 내비게이션 바는 이 스크립트가 채워 넣는다.
 * 20여 개 화면에서 같은 마크업이 반복되는 것을 막기 위한 장치일 뿐,
 * 실제 앱 구현에서는 OS가 그리는 영역이므로 이식 대상이 아니다.
 */
(function () {
  'use strict';

  const STATUS_BAR_MARKUP = `
    <div class="lf-statusbar">
      <span class="lf-statusbar__time">9:30</span>
      <span class="lf-statusbar__punchhole"></span>
      <span class="lf-statusbar__icons">
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
          <path d="M8 13.3L.67 5.97a10.37 10.37 0 0114.66 0L8 13.3z" fill="currentColor"/>
        </svg>
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
          <path d="M14.67 14.67V1.33L1.33 14.67h13.34z" fill="currentColor"/>
        </svg>
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
          <rect x="3.75" y="2" width="8.5" height="13" rx="1.5" fill="currentColor"/>
          <rect x="5.5" y="0.9" width="5" height="2" rx="0.5" fill="currentColor"/>
        </svg>
      </span>
    </div>`;

  const NAV_BAR_MARKUP = '<div class="lf-navbar"></div>';

  document.querySelectorAll('.lf-device').forEach(function (device) {
    device.insertAdjacentHTML('afterbegin', STATUS_BAR_MARKUP);
    device.insertAdjacentHTML('beforeend', NAV_BAR_MARKUP);
  });

  // 화면 하단 캡션 — SCR-ID와 화면명을 문서 데이터에서 읽어 표시한다.
  const page = document.body;
  const screenId = page.dataset.screenId;
  const screenName = page.dataset.screenName;

  if (screenId && !page.querySelector('.lf-page__caption')) {
    const caption = document.createElement('p');
    caption.className = 'lf-page__caption';

    const idLabel = document.createElement('strong');
    idLabel.textContent = screenId;
    caption.append(idLabel, ' ' + (screenName || ''));

    page.appendChild(caption);
  }
})();
