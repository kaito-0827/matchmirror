"""parse_json_response のLLM出力ゆらぎ耐性テスト。"""
import pytest
from app.agents.base import parse_json_response


def test_plain_json():
    assert parse_json_response('{"a": 1}') == {"a": 1}


def test_json_array():
    assert parse_json_response('[1, 2, 3]') == [1, 2, 3]


def test_markdown_fence():
    assert parse_json_response('```json\n{"a": 1}\n```') == {"a": 1}


def test_fence_without_lang():
    assert parse_json_response('```\n{"a": 1}\n```') == {"a": 1}


def test_fence_with_trailing_prose():
    text = '```json\n{"a": 1}\n```\n以上が診断結果です。'
    assert parse_json_response(text) == {"a": 1}


def test_prose_before_and_after():
    text = '診断結果は以下の通りです。\n{"a": 1, "b": [2, 3]}\nご確認ください。'
    assert parse_json_response(text) == {"a": 1, "b": [2, 3]}


def test_trailing_comma_repair():
    text = '{"a": 1, "b": [2, 3,],}'
    assert parse_json_response(text) == {"a": 1, "b": [2, 3]}


def test_no_json_raises():
    with pytest.raises(Exception):
        parse_json_response('JSONを生成できませんでした。')
