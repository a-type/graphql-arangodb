import chalk from 'chalk';

const tag = '[graphql-cypher] ';

export const log = ({
  title,
  level,
  details,
}: {
  title: string;
  level: 'info' | 'debug' | 'verbose' | 'error';
  details: string[];
}) => {
  if (level === 'verbose' && __DEV__ && process.env.DEBUG) {
    console.debug(
      [chalk.yellow(tag + title), ...details.map(str => chalk.gray(str))].join(
        '\n'
      )
    );
  } else if (level === 'debug' && process.env.DEBUG) {
    console.debug(
      [chalk.cyan(tag + title), ...details.map(str => chalk.gray(str))].join(
        '\n'
      )
    );
  } else if (level === 'error') {
    console.error([tag + title, ...details].join('\n'));
  } else if (level === 'info') {
    console.info(
      [chalk.blue(tag + title), ...details.map(str => chalk.gray(str))].join(
        '\n'
      )
    );
  }
};
