# First answer-content batch

Status: A1 published on 2026-09-15; A2/A3 remain drafts. No search volume or outcomes assumed.
The PO authorized first-content publication. A1 uses the existing web/spec record-led framing;
cross-channel positioning alignment remains a later decision, not a publication gate.
Published copy lives in `apps/web/src/screens/promise-guide-labels.ts` and explicitly states
Kakao/Google sign-in is required. The editorial drafts below preserve the earlier working material.
Product evidence: approved `HOME_LABEL`, shared routes and product specification. Review against
the running release before publication. Use localized catalogs and existing design tokens when
porting these drafts into web pages. Each page needs a self canonical, static text, a home link,
an accurate review date and a relevant next step; never an invite token in its public URL.

## A1 — What the product does

Published: https://littlefinger-app.web.app/guides/promise-record
Intent: decide whether this solves a mutual-record problem.

### Korean draft

# 둘이 정한 약속, 같은 내용으로 기억하려면

리틀핑거는 두 사람이 함께 정한 약속을 하나의 기록으로 남기는 서비스예요. 약속을 만드는
사람은 Android 앱을 쓰고, 상대는 받은 초대 링크에서 앱 설치 없이 내용을 확인하고 수락해요.

## 약속을 적기 전에 함께 정할 것

- 무엇을 할지: 두 사람이 같은 뜻으로 이해할 수 있게 적어요.
- 누가 지킬지: 약속을 지킬 사람을 정해요.
- 언제 확인할지: 종료일을 정하고, 어떤 결과를 확인할지도 이야기해요.

예를 들어 “공부 열심히 하기”보다 “이번 토요일까지 3장을 읽고, 서로 읽은 부분을 이야기하기”가
무엇을 약속했는지 다시 확인하기 쉬워요. 이 예시는 서비스 사용을 설명하기 위한 가상의 약속이에요.

## 리틀핑거에서는 이렇게 남겨요

Android 앱에서 약속을 작성하고 초대 링크를 보내요. 상대가 내용을 확인하고 수락하면 함께
정한 약속으로 시작돼요. 확정된 내용을 바꾸고 싶을 때는 새 버전으로 다시 합의해요.

리틀핑거는 누가 옳은지 판정하지 않아요. 결과에 대한 답이 다르면 두 사람의 답을 나란히
기록해요. 돈을 맡아 두거나 벌칙을 대신 받아 주지도 않아요.

다음 행동: **Google Play에서 받기**. 상대의 참여 방법은 설치 없이 수락하는 안내에서 확인해요.

### English companion draft

# Keep the same record of the promise you made together

Littlefinger records a promise agreed by two people. The creator uses the Android app. The other
person reviews and accepts an invite link on the web without installing the app.

Agree on what to do, who will do it, and when and how to check the result. For example, “Read
chapter three by Saturday and discuss what we read” is easier to revisit than “Study harder.”
This is an illustrative example, not a report about a real user.

Write the promise, share the invite link, and let the other person review it. After confirmation,
changes require a new agreed version. If your answers about the result differ, Littlefinger
records both answers without deciding who is right. It does not hold or collect money.

Next step: **Get it on Google Play**. Link to the web participation guide.

## A2 — Installation and device answer

Proposed path: `/guides/web-participation`. Intent: understand the Android/iPhone boundary.

### Korean draft

# 상대도 리틀핑거 앱을 설치해야 하나요?

아니요. 약속을 만드는 사람은 Android 앱을 쓰지만, 상대는 초대 링크에서 앱 설치 없이
약속 내용을 확인하고 수락할 수 있어요. 아이폰에서도 웹으로 참여할 수 있어요.

## 설치 없이 참여하는 순서

1. 받은 초대 링크를 열어요.
2. 안내에 따라 로그인하고 약속 내용을 확인해요.
3. 함께 정한 내용인지 확인한 뒤 수락해요.

앱을 설치하지 않는다는 뜻이지, 로그인 없이 수락한다는 뜻은 아니에요. 현재 아이폰에서
새 약속을 만드는 앱은 제공하지 않아요. 초대받은 약속에 웹으로 참여하는 것은 가능해요.

직접 약속을 만들고 싶다면 Android에서 **Google Play에서 받기**를 선택해요.

### English companion draft

# Does the other person need to install Littlefinger?

No. The creator uses the Android app, while the invited person can review and accept the promise
on the web without installing it. An iPhone can be used for web participation.

Open the invite link, follow the sign-in instructions, review the promise, and accept if it matches
what you agreed. Installation-free does not mean sign-in-free. There is currently no iPhone app
for creating promises. To create a promise on Android, choose **Get it on Google Play**.

## A3 — A worked example rather than another generic tips page

Proposed path: `/guides/study-promise`. Intent: translate a vague intention into a shared record.

### Korean draft

# 친구와 공부 약속을 정할 때 적어 둘 세 가지

공부 약속을 기록할 때는 할 일, 지킬 사람, 확인할 날을 함께 정해 보세요. 같은 문장을
읽어도 서로 다른 뜻으로 이해하지 않도록, 결과를 어떻게 확인할지도 이야기해 두면 좋아요.

가상의 예시: “나는 이번 토요일까지 교재 3장을 읽고, 친구에게 기억에 남는 내용을 이야기한다.”
누가 할 일인지, 어디까지 할지, 언제 확인할지가 들어 있어요. 성적 향상이나 약속 이행을
보장하는 방법은 아니에요.

리틀핑거에서 내용을 작성하고 상대에게 초대 링크를 보내면, 상대도 내용을 확인하고
수락할 수 있어요. 함께 확정한 뒤 내용을 바꾸려면 새 버전으로 다시 합의해요.

실제 약속 내용이나 확인 사진을 홍보를 위해 공개할 필요는 없어요. 두 사람이 합의한 내용을
두 사람의 기록으로 남겨요. 다음 행동: **Google Play에서 받기**.

### English companion draft

# Three things to write down for a study promise with a friend

Agree on the task, the person who will keep the promise, and the day to check it. Discuss how you
will check the result so that you understand the words in the same way.

Illustrative example: “I will read chapter three by Saturday and tell my friend what stood out.”
It identifies the person, task and date; it does not guarantee better grades or follow-through.

Write the promise in Littlefinger and send an invite link for the other person to review and
accept. Changes after confirmation need a new agreed version. You do not need to publish private
promise contents or confirmation photos for promotion. Next step: **Get it on Google Play**.

## Distribution draft — adapt only after channel review

Disclosure and text: “리틀핑거를 만드는 팀입니다. 친구와 정한 약속을 기록할 때 무엇을 적으면
좋을지, 가상의 예시로 정리했어요. 약속 작성은 Android 앱, 상대의 수락은 설치 없는 웹에서
가능합니다. [공개 안내 글]에서 사용 방법과 제한을 확인할 수 있어요.”

Replace the bracket only with the published guide URL. Choose one relevant community whose rules
permit maker posts. No fake customer voice, unsolicited DMs, or incentivized reviews. This file
contains no authorization to post to an external account and no claim that outreach has happened.
