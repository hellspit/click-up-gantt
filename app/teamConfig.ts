export interface TeamDef {
  key: string;
  name: string;
  description: string;
  color: string;
  icon: string;
  memberNames: string[];
}

export const TEAMS: TeamDef[] = [
  {
    key: 'ams',
    name: 'AMS',
    description: 'Application Management Services',
    color: '#58a6ff',
    icon: '🔷',
    memberNames: [
      'Gulshan Poddar',
      'Arka Chowdhury',
      'Aniruddh CHoudhary',
      'Samanway Pal',
      'Manash Dey',
      'Ayash Ashraf',
      'Irappa Bagodi',
      'Subodh Kumar',
      'Ebin Abraham',
      'hareesh th',
      'KiritkumarP',
    ],
  },
  {
    key: 'rtl',
    name: 'RTL',
    description: 'RTL Team',
    color: '#bc8cff',
    icon: '🔶',
    memberNames: [
      'Abhishek Sarkar',
      'Arka Chakraborty',
      'Souptik Dolui',
      'Sharanya Shetty',
      'Dheerajeswar Saluru',
      'Manav',
      'Archisman Ghosh',
      'Sayantan Dey',
      'Ushasi Das',
      'Himanshu Shaw',
      'Charles Adeyanju',
      'Manash Dey',
    ],
  },
  {
    key: 'ps',
    name: 'PS',
    description: 'Professional Services',
    color: '#3fb950',
    icon: '🟢',
    memberNames: [
      'Vinayak Agrawal',
      'Manash Dey',
      'sumon',
      'Shiva Teja',
      'Anish Saha',
      'Deepthi Kammath',
      'Tomin Jose',
      'Sarat Anumula',
      'Kumaresh Dhotrad',
      'Ashutosh Nahar',
    ],
  },
];

export function getTeamByKey(key: string): TeamDef | undefined {
  return TEAMS.find(t => t.key === key);
}
