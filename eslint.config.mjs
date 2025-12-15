import eslintConfigNext from 'eslint-config-next';
import eslintConfigPrettier from 'eslint-config-prettier';
import prettierPlugin from 'eslint-plugin-prettier';

const eslintConfig = [
	...eslintConfigNext,
	eslintConfigPrettier,
	{
		plugins: {
			prettier: prettierPlugin,
		},
		rules: {
			'prettier/prettier': [
				'error',
				{
					endOfLine: 'auto',
				},
			],
			'@next/next/no-img-element': 'off',
		},
	},
];

export default eslintConfig;
