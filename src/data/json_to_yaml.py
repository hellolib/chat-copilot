#!/usr/bin/env python3
"""
JSON 转 YAML 脚本
将 prompts/ 目录下的 JSON 文件转换为 prompts_yaml/ 目录下的 YAML 文件

使用方法:
    python3 src/data/json_to_yaml.py                    # 转换所有缺失的 YAML 文件
    python3 src/data/json_to_yaml.py hallucination      # 只转换 hallucination.json
    python3 src/data/json_to_yaml.py --force            # 强制覆盖已存在的 YAML 文件
"""

import json
import yaml
import sys
from pathlib import Path


def json_to_yaml(json_file: Path, yaml_file: Path, force: bool = False) -> bool:
    """
    将单个 JSON 文件转换为 YAML 文件

    Args:
        json_file: JSON 源文件路径
        yaml_file: YAML 目标文件路径
        force: 是否强制覆盖已存在的文件

    Returns:
        bool: 转换是否成功
    """
    try:
        # 检查 YAML 文件是否已存在
        if yaml_file.exists() and not force:
            print(f"⏭️  跳过: {yaml_file.name} 已存在（使用 --force 强制覆盖）")
            return True

        # 读取 JSON 文件
        with open(json_file, 'r', encoding='utf-8') as f:
            data = json.load(f)

        # 验证必需字段
        required_fields = ['category', 'name', 'icon', 'prompts']
        for field in required_fields:
            if field not in data:
                print(f"❌ 错误: {json_file.name} 缺少必需字段 '{field}'")
                return False

        # 写入 YAML 文件
        with open(yaml_file, 'w', encoding='utf-8') as f:
            # 使用自定义的 YAML 格式化
            yaml.dump(
                data,
                f,
                allow_unicode=True,
                default_flow_style=False,
                sort_keys=False,
                width=1000,  # 避免长行自动换行
            )

        action = "覆盖" if yaml_file.exists() else "创建"
        print(f"✅ {action}成功: {json_file.name} -> {yaml_file.name}")
        print(f"   包含 {len(data['prompts'])} 个提示词")
        return True

    except json.JSONDecodeError as e:
        print(f"❌ JSON 解析错误: {json_file.name}")
        print(f"   {str(e)}")
        return False
    except Exception as e:
        print(f"❌ 转换失败: {json_file.name}")
        print(f"   {str(e)}")
        return False


def main():
    # 获取脚本所在目录
    script_dir = Path(__file__).parent
    json_dir = script_dir / 'prompts'
    yaml_dir = script_dir / 'prompts_yaml'

    # 确保目录存在
    if not json_dir.exists():
        print(f"❌ 错误: JSON 目录不存在: {json_dir}")
        sys.exit(1)

    yaml_dir.mkdir(exist_ok=True)

    # 解析命令行参数
    force = '--force' in sys.argv
    args = [arg for arg in sys.argv[1:] if arg != '--force']

    # 确定要转换的文件
    if args:
        # 转换指定的文件
        categories = args
        json_files = [json_dir / f"{cat}.json" for cat in categories]

        # 检查文件是否存在
        for json_file in json_files:
            if not json_file.exists():
                print(f"❌ 错误: 文件不存在: {json_file}")
                sys.exit(1)
    else:
        # 转换所有 JSON 文件（默认跳过已存在的 YAML）
        json_files = list(json_dir.glob('*.json'))
        if not json_files:
            print(f"❌ 错误: 在 {json_dir} 中没有找到 .json 文件")
            sys.exit(1)

    # 执行转换
    print(f"\n开始转换 {len(json_files)} 个文件...\n")

    success_count = 0
    skip_count = 0
    fail_count = 0

    for json_file in json_files:
        yaml_file = yaml_dir / f"{json_file.stem}.yaml"

        # 检查是否跳过
        if yaml_file.exists() and not force:
            skip_count += 1
            print(f"⏭️  跳过: {yaml_file.name} 已存在")
            continue

        if json_to_yaml(json_file, yaml_file, force):
            success_count += 1
        else:
            fail_count += 1

    # 输出统计信息
    print(f"\n{'='*50}")
    print(f"转换完成!")
    print(f"成功: {success_count} 个")
    print(f"跳过: {skip_count} 个")
    print(f"失败: {fail_count} 个")
    print(f"{'='*50}\n")

    if fail_count > 0:
        sys.exit(1)


if __name__ == '__main__':
    main()
