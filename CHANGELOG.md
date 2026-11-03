# Changelog

## [1.3.0](https://github.com/matthewlyle/mediahooks/compare/v1.2.1...v1.3.0) (2026-11-03)


### Features

* log refused sign-ins ([f424983](https://github.com/matthewlyle/mediahooks/commit/f4249832d0c4faf5dc1a716292fd0d60c4f23878))
* show the running version on the Help page and at startup ([f424983](https://github.com/matthewlyle/mediahooks/commit/f4249832d0c4faf5dc1a716292fd0d60c4f23878))


### Bug Fixes

* don't print a localhost webhook URL at startup ([f424983](https://github.com/matthewlyle/mediahooks/commit/f4249832d0c4faf5dc1a716292fd0d60c4f23878))
* tag ntfy notifications with the media type instead of always tv ([f424983](https://github.com/matthewlyle/mediahooks/commit/f4249832d0c4faf5dc1a716292fd0d60c4f23878))

## [1.2.1](https://github.com/matthewlyle/mediahooks/compare/v1.2.0...v1.2.1) (2026-11-03)


### Bug Fixes

* **a11y:** announce column names with each event row value ([#45](https://github.com/matthewlyle/mediahooks/issues/45)) ([d8b2ba2](https://github.com/matthewlyle/mediahooks/commit/d8b2ba225e58185f297614be0a3cca935d869ea0))
* **a11y:** announce copy, send-test, sign-in and field-error status messages ([#25](https://github.com/matthewlyle/mediahooks/issues/25)) ([4d32b7a](https://github.com/matthewlyle/mediahooks/commit/4d32b7a9018517bcbc0e074aba684d07ebb09732))
* **a11y:** dim and label paused webhooks without lowering contrast ([#32](https://github.com/matthewlyle/mediahooks/issues/32)) ([8248e57](https://github.com/matthewlyle/mediahooks/commit/8248e57bec1e9f0493fb4910f9f8ee6ec39d11a3))
* **a11y:** draw the focus ring outside controls ([#34](https://github.com/matthewlyle/mediahooks/issues/34)) ([6e048d0](https://github.com/matthewlyle/mediahooks/commit/6e048d08e02d95ed6a0bf5e5e15b9a0f72929796))
* **a11y:** give each view a descriptive page title ([#22](https://github.com/matthewlyle/mediahooks/issues/22)) ([0058e0e](https://github.com/matthewlyle/mediahooks/commit/0058e0e17d7cd3b1d934df1bef1be21f639d56c0))
* **a11y:** give editor fields and the switch track a visible boundary ([#36](https://github.com/matthewlyle/mediahooks/issues/36)) ([5284bad](https://github.com/matthewlyle/mediahooks/commit/5284badb9f96189643aa9aa466fd1b36e9e6f6f3))
* **a11y:** give every view a heading and a banner landmark ([ba25c84](https://github.com/matthewlyle/mediahooks/commit/ba25c8415198891e7f65e717094724b4ebc491a9))
* **a11y:** keep focus in the New webhook dialog when an Undo toast is showing ([#51](https://github.com/matthewlyle/mediahooks/issues/51)) ([20fecd0](https://github.com/matthewlyle/mediahooks/commit/20fecd057a90ee849491c24813aa46d61c9e373a))
* **a11y:** keep Send test's name and announce sending ([#24](https://github.com/matthewlyle/mediahooks/issues/24)) ([bf56e0c](https://github.com/matthewlyle/mediahooks/commit/bf56e0c39fb6a5c0db0680235fdd0f37117ce275))
* **a11y:** keep the delete Undo toast until it's dismissed ([c29f9bc](https://github.com/matthewlyle/mediahooks/commit/c29f9bc5a5517b0e5e9da5fb74596449f5c1fca3))
* **a11y:** let Tab leave the code editors ([#43](https://github.com/matthewlyle/mediahooks/issues/43)) ([374c7b3](https://github.com/matthewlyle/mediahooks/commit/374c7b3c63fcd0b63955809580aae35c77bf3e2a))
* **a11y:** make the whole webhook row one link ([#47](https://github.com/matthewlyle/mediahooks/issues/47)) ([f8fe503](https://github.com/matthewlyle/mediahooks/commit/f8fe503b6e0aa8ff79ebd471147df5e701bf5455))
* **a11y:** make webhook rows real links ([#23](https://github.com/matthewlyle/mediahooks/issues/23)) ([d017500](https://github.com/matthewlyle/mediahooks/commit/d0175005446a9e69ab0df6305e67767acd569273))
* **a11y:** mark Name and URL as required in their labels ([5dcfde1](https://github.com/matthewlyle/mediahooks/commit/5dcfde1b114fbe50949b3777cbfbf93242a27ce5))
* **a11y:** mark the current nav item with bold weight, not colour alone ([#28](https://github.com/matthewlyle/mediahooks/issues/28)) ([84e338f](https://github.com/matthewlyle/mediahooks/commit/84e338f87e9ea58afd40de29ae163b46098ada11))
* **a11y:** move focus to the view heading after navigating ([#48](https://github.com/matthewlyle/mediahooks/issues/48)) ([393b487](https://github.com/matthewlyle/mediahooks/commit/393b4879f7112c7c049f555862d18f2b76790c6b))
* **a11y:** show delivery outcome on the status badge without colour ([#30](https://github.com/matthewlyle/mediahooks/issues/30)) ([66843e7](https://github.com/matthewlyle/mediahooks/commit/66843e74e073b28672414ad7ab43d31783b54757))
* **a11y:** show failed toggles, duplicates and token replaces in a toast ([#52](https://github.com/matthewlyle/mediahooks/issues/52)) ([1f48ddb](https://github.com/matthewlyle/mediahooks/commit/1f48ddb59fb67d115a9ab95d3b83d2b456d51312))
* **a11y:** stop the webhook detail page scrolling sideways at 320px ([#39](https://github.com/matthewlyle/mediahooks/issues/39)) ([aa32827](https://github.com/matthewlyle/mediahooks/commit/aa328278ce5429ef5dfeccd65345bc2a3bd87d87))
* **a11y:** wrap long webhook names on the list ([#29](https://github.com/matthewlyle/mediahooks/issues/29)) ([e07ba47](https://github.com/matthewlyle/mediahooks/commit/e07ba471ed9f99fbce39aadcdc1211bb8397c696))
* **a11y:** wrap truncated text instead of hiding it in tooltips ([#58](https://github.com/matthewlyle/mediahooks/issues/58)) ([c1ad9a2](https://github.com/matthewlyle/mediahooks/commit/c1ad9a23f52b829adfcd1c927c22e0711bf60063))

## [1.2.0](https://github.com/matthewlyle/mediahooks/compare/v1.1.0...v1.2.0) (2026-11-02)

### Features

* Keep the newest 10 events of each media type, so a burst of one kind (a big movie import) can't push episodes or music out of the editor preview.

### Bug Fixes

* The built-in sample preview and send test no longer use another event's poster.

## [1.1.0](https://github.com/matthewlyle/mediahooks/compare/v1.0.0...v1.1.0) (2026-11-02)

### Features

* `PLEX_URL` defaults to `http://localhost:32400`, and the image defaults to `http://host.docker.internal:32400`, so most setups don't need to set it.

## 1.0.0 (2026-11-02)

First release.
