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
    description: 'Analog and Mixed Signal',
    color: '#58a6ff',
    icon: 'AMS',
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
    icon: 'RTL',
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
    description: 'post silicon',
    color: '#3fb950',
    icon: 'PS',
    memberNames: [
      'Vinayak Agrawal',
      'Manash Dey',
      'sumon',
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
