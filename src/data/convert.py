#!/usr/bin/env python3
"""
提示词配置转换脚本
将 YAML 格式的提示词配置转换为 JSON 格式

使用方法:
    python3 src/data/convert.py                    # 转换所有文件
    python3 src/data/convert.py logic              # 只转换 logic.yaml
    python3 src/data/convert.py logic knowledge    # 转换多个指定文件
"""

import json
import yaml
import sys
from pathlib import Path


def convert_yaml_to_json(yaml_file: Path, json_file: Path) -> bool:
    """
    将单个 YAML 文件转换为 JSON 文件

    Args:
        yaml_file: YAML 源文件路径
        json_file: JSON 目标文件路径

    Returns:
        bool: 转换是否成功
    """
    try:
        # 读取 YAML 文件
        with open(yaml_file, 'r', encoding='utf-8') as f:
            data = yaml.safe_load(f)

        # 验证必需字段
        required_fields = ['category', 'name', 'icon', 'prompts']
        for field in required_fields:
            if field not in data:
                print(f"❌ 错误: {yaml_file.name} 缺少必需字段 '{field}'")
                return False

        # 验证每个提示词的必需字段
        for i, prompt in enumerate(data['prompts']):
            prompt_required = ['id', 'title', 'content', 'tags']
            for field in prompt_required:
                if field not in prompt:
                    print(f"❌ 错误: {yaml_file.name} 中第 {i+1} 个提示词缺少必需字段 '{field}'")
                    return False

        # 写入 JSON 文件（格式化输出，使用 2 空格缩进）
        with open(json_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

        print(f"✅ 转换成功: {yaml_file.name} -> {json_file.name}")
        print(f"   包含 {len(data['prompts'])} 个提示词")
        return True

    except yaml.YAMLError as e:
        print(f"❌ YAML 解析错误: {yaml_file.name}")
        print(f"   {str(e)}")
        return False
    except Exception as e:
        print(f"❌ 转换失败: {yaml_file.name}")
        print(f"   {str(e)}")
        return False


def main():
    # 获取脚本所在目录
    script_dir = Path(__file__).parent
    yaml_dir = script_dir / 'prompts_yaml'
    json_dir = script_dir / 'prompts'

    # 确保目录存在
    if not yaml_dir.exists():
        print(f"❌ 错误: YAML 目录不存在: {yaml_dir}")
        sys.exit(1)

    json_dir.mkdir(exist_ok=True)

    # 确定要转换的文件
    if len(sys.argv) > 1:
        # 转换指定的文件
        categories = sys.argv[1:]
        yaml_files = [yaml_dir / f"{cat}.yaml" for cat in categories]

        # 检查文件是否存在
        for yaml_file in yaml_files:
            if not yaml_file.exists():
                print(f"❌ 错误: 文件不存在: {yaml_file}")
                sys.exit(1)
    else:
        # 转换所有 YAML 文件
        yaml_files = list(yaml_dir.glob('*.yaml'))
        if not yaml_files:
            print(f"❌ 错误: 在 {yaml_dir} 中没有找到 .yaml 文件")
            sys.exit(1)

    # 执行转换
    print(f"\n开始转换 {len(yaml_files)} 个文件...\n")

    success_count = 0
    fail_count = 0

    for yaml_file in yaml_files:
        json_file = json_dir / f"{yaml_file.stem}.json"
        if convert_yaml_to_json(yaml_file, json_file):
            success_count += 1
        else:
            fail_count += 1

    # 输出统计信息
    print(f"\n{'='*50}")
    print(f"转换完成!")
    print(f"成功: {success_count} 个")
    print(f"失败: {fail_count} 个")
    print(f"{'='*50}\n")

    if fail_count > 0:
        sys.exit(1)


if __name__ == '__main__':
    main()
