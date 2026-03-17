# AGENTS.md

## Repo Rules

- 実装と検証で使う標準コマンドは次のとおり。

```bash
npm run build
npm test
npm run lint
npm run typecheck
```

- `note` から `eleven v3 prompt` への 1 発変換を禁止する。
- 段階は必ず `note -> brief -> spoken script -> eleven v3 prompt -> qa report` に分離する。
- 中間成果物は必ずファイルとして保存する。
- CLI、JSON 仕様、段構成を変えた場合は `spec.md`、`plans.md`、`README.md` を同じ変更で同期する。
- Done は、対象マイルストーンに対応する検証コマンドが通っている状態とする。
