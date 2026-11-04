# Contributing

Thanks for looking. This is a personal project: the code behind
[yehudabriskman.com](https://yehudabriskman.com), written and run by one person.
That shapes how contributions work here.

**Issues welcome, pull requests by invitation.**

## Issues

Open one for any of these:

- a bug on the live site or in the code (a broken page, a wrong render in
  English or Hebrew, an accessibility problem);
- an idea or a question about how something here works;
- something in the docs that is wrong or unclear.

Use the templates under **New issue**. A link, the browser and the language
(`/` or `/he`) you were on go a long way.

## Pull requests

Please do not open a pull request unprompted. Open an issue first. If a change
makes sense and you would like to write it, say so in the issue, and if the
answer is yes you will be asked for a PR there. An unrequested PR may be closed
without review. That is not a judgement of the code: it is that every change
here is something one person has to keep running.

When you have been asked for one:

- branch from `main` and keep the change to one subject;
- run `make check` (exactly what CI runs on a pull request) and say in the PR
  what you checked by hand;
- fill in the pull request template.

Every pull request has to pass the required `CI gate` and `Static` checks.

## Licence of contributions

The code is MIT-licensed ([LICENSE](../LICENSE)); the site's content is not
([LICENSE-CONTENT](../LICENSE-CONTENT)). By contributing code you agree that it
is licensed under the MIT License. Please do not contribute content (text or
images for the site itself).

## Conduct and security

Be decent: see the [Code of Conduct](CODE_OF_CONDUCT.md). Never report a
vulnerability in a public issue: see the [security policy](SECURITY.md).
